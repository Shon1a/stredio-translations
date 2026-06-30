#!/usr/bin/env node
/* Validates every language file against en.json (the source of truth):
 * - valid JSON
 * - listed in index.json
 * - no keys that don't exist in en.json
 * - reports (non-fatally) any en.json keys that are missing
 * - {placeholder} tokens match en.json
 * Exit code 1 on any hard error. Run: `node validate.js`
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

  if (extra.length)   { console.error(`✗ ${lang.file}: ${extra.length} unknown key(s):`, extra.slice(0, 10)); hardErrors++; }
  if (badTokens.length){ console.error(`✗ ${lang.file}: ${badTokens.length} key(s) with mismatched {placeholders}:`, badTokens.slice(0, 10)); hardErrors++; }
  if (missing.length) { console.warn(`⚠ ${lang.file}: ${missing.length} key(s) missing (will fall back to English)`); }
  if (!extra.length && !badTokens.length && !missing.length) console.log(`✓ ${lang.file}: complete (${enKeys.length} keys)`);
  else if (!extra.length && !badTokens.length) console.log(`✓ ${lang.file}: valid, ${enKeys.length - missing.length}/${enKeys.length} translated`);
}

// any json file in the repo not listed in the manifest?
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith('.json') && f !== 'index.json' && !listed.has(f))
    console.warn(`⚠ ${f}: present but not listed in index.json`);
}

console.log(hardErrors ? `\n${hardErrors} error(s).` : '\nAll good.');
process.exit(hardErrors ? 1 : 0);
