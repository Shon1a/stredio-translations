#!/usr/bin/env node
/* Validates every language file against en.json (the source of truth):
 * - valid JSON
 * - listed in index.json
 * - no keys that don't exist in en.json
 * - reports (non-fatally) any en.json keys that are missing
 * - {placeholder} tokens match en.json
 * Exit code 1 on any hard error. Run: `node validate.js`
 *
 * A note on what this can and cannot see. en.json is the source of truth *here*, but
 * the app's real dictionary is src/i18n/{en-base,en}.ts in Stredio-Web — this repo has
 * no access to it. So en.json can silently fall behind the app: keys ship, translators
 * never learn they exist, and every language quietly renders them in English. That is
 * exactly what happened (en.json sat 95 keys behind), and the only symptom visible from
 * here was the reverse-looking one: a language file carrying keys en.json had never
 * heard of, which this script reported as the language's fault ("unknown key"). It is
 * almost never the language's fault. See the diagnosis under "unknown key(s)" below.
 *
 * To resync: regenerate en.json from the app's EN table ({ ...EN_BASE, ...SEED }), then
 * bump TVER in Stredio-Web/src/i18n/i18n.tsx or jsDelivr serves the old files for ~12h.
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const tokens = s => (String(s).match(/\{[^}]+\}/g) || []).sort().join(',');

let hardErrors = 0;
const en = read('en.json');
const enKeys = Object.keys(en);
const manifest = read('index.json');
const listed = new Set(manifest.languages.map(l => l.file));

for (const lang of manifest.languages) {
  if (!fs.existsSync(path.join(dir, lang.file))) {
    console.error(`✗ ${lang.code}: file "${lang.file}" listed in index.json is missing`);
    hardErrors++;
    continue;
  }
  if (lang.code === manifest.source) continue;
  let data;
  try { data = read(lang.file); }
  catch (e) { console.error(`✗ ${lang.file}: invalid JSON — ${e.message}`); hardErrors++; continue; }

  const extra = Object.keys(data).filter(k => !(k in en));
  const missing = enKeys.filter(k => !(k in data));
  const badTokens = Object.keys(data).filter(k => k in en && tokens(data[k]) !== tokens(en[k]));
  const empty = Object.keys(data).filter(k => k in en && String(data[k]).trim() === '');
  const untranslated = Object.keys(data).filter(k => k in en && data[k] === en[k] && String(en[k]).trim() !== '');

  if (extra.length) {
    console.error(`✗ ${lang.file}: ${extra.length} key(s) that en.json has never heard of:`, extra.slice(0, 10));
    console.error(`    Before "fixing" ${lang.file}: a translator cannot invent keys, so these almost`);
    console.error(`    certainly came from the app and en.json is STALE. Check whether the app calls`);
    console.error(`    them (grep "t('<key>'" in Stredio-Web/src). If it does, resync en.json — do NOT`);
    console.error(`    delete them from ${lang.file}, that would throw away real translations.`);
    hardErrors++;
  }
  if (badTokens.length) {
    console.error(`✗ ${lang.file}: ${badTokens.length} key(s) with mismatched {placeholders}:`, badTokens.slice(0, 10));
    hardErrors++;
  }
  if (empty.length) {
    console.error(`✗ ${lang.file}: ${empty.length} key(s) with an empty value (renders as blank, not as English):`, empty.slice(0, 10));
    hardErrors++;
  }
  if (missing.length) {
    const byGroup = {};
    for (const k of missing) (byGroup[k.split('.')[0]] ||= []).push(k);
    const top = Object.entries(byGroup).sort((a, b) => b[1].length - a[1].length).slice(0, 5)
      .map(([g, ks]) => `${g}.* (${ks.length})`).join(', ');
    console.warn(`⚠ ${lang.file}: ${missing.length} key(s) missing (will fall back to English) — mostly ${top}`);
  }
  if (untranslated.length) {
    console.warn(`⚠ ${lang.file}: ${untranslated.length} key(s) present but identical to English (copied, not translated?)`);
  }
  const done = enKeys.length - missing.length;
  const pct = ((100 * done) / enKeys.length).toFixed(1);
  if (!extra.length && !badTokens.length && !empty.length && !missing.length) {
    console.log(`✓ ${lang.file}: complete (${enKeys.length} keys)`);
  } else if (!extra.length && !badTokens.length && !empty.length) {
    console.log(`✓ ${lang.file}: valid, ${done}/${enKeys.length} translated (${pct}%)`);
  }
}

// any json file in the repo not listed in the manifest?
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith('.json') && f !== 'index.json' && !listed.has(f))
    console.warn(`⚠ ${f}: present but not listed in index.json`);
}

console.log(hardErrors ? `\n${hardErrors} error(s).` : '\nAll good.');
console.log(`\nNote: "complete" means complete against en.json (${enKeys.length} keys). It cannot`);
console.log(`prove en.json itself is current with the app — see the header comment.`);
process.exit(hardErrors ? 1 : 0);
