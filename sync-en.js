#!/usr/bin/env node
/* Regenerates en.json from the app's dictionary, so it can't silently fall behind.
 *
 * WHY THIS EXISTS
 * There are two English lists: the app's (Stredio-Web/src/i18n/{en-base,en}.ts, which
 * is what users actually see) and this repo's en.json (which is what translators read
 * and translate). Nothing linked them, so shipping a feature added strings to the first
 * and not the second — and a translator cannot translate a string they were never shown.
 * en.json drifted 95 keys behind before anyone noticed, and the only visible symptom was
 * backwards: validate.js reporting the *language* file as having "unknown" keys.
 * The app is the source of truth. This script makes en.json a mirror of it.
 *
 * WHAT IT WILL AND WON'T TOUCH
 * Adding a key is mechanical: it is new, nobody has translated it, copying the app's
 * English in is always right. REWORDING an existing key is editorial, and automating it
 * is dangerous — the first run of this script wanted to rewrite 39 values, and among the
 * harmless "LOAD MORE" -> "Load more" cases were: hero.play "Play" -> "MORE",
 * modal.watch "OPEN" -> "WATCH", settings.language "Audio language" -> "Language",
 * hero.plot_fallback -> "" (empty), and legal.privacy_body, where one version tells users
 * their search terms reach Google Translate and the other does not. A script must not pick
 * a side in a privacy policy. So: adds are applied, rewordings are REPORTED ONLY.
 *
 * USAGE
 *   node sync-en.js           add missing keys to en.json; report rewordings
 *   node sync-en.js --check   exit 1 if keys are missing (what CI runs)
 *   node sync-en.js --local ../Stredio-Web   read from a local checkout instead of GitHub
 *
 * Existing keys keep their position so the diff stays readable; new keys are appended.
 */
const fs = require('fs');
const path = require('path');

const RAW = 'https://raw.githubusercontent.com/Shon1a/Stredio-Web/main/src/i18n/';
const FILES = ['en-base.ts', 'en.ts'];         // merge order: { ...EN_BASE, ...SEED }
const MIN_KEYS = 400;                          // sanity floor — see checkSane()

const args = process.argv.slice(2);
const check = args.includes('--check');
const localIdx = args.indexOf('--local');
const localDir = localIdx >= 0 ? args[localIdx + 1] : null;

/* Parse `"key": "value"` / `'key': 'value'` / `'key': `value`` pairs out of a TS module.
 * Regex rather than a TS parser to keep this dependency-free; checkSane() below is what
 * makes that safe — a silently-broken parser would otherwise emit a near-empty en.json
 * and wipe the translators' list. */
function parseDict(src) {
  const out = Object.create(null);
  for (const m of src.matchAll(/^\s*"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/gm)) out[m[1]] = JSON.parse('"' + m[2] + '"');
  for (const m of src.matchAll(/^\s*'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'/gm)) out[m[1]] = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  for (const m of src.matchAll(/^\s*'([^']+)'\s*:\s*`([^`]*)`/gm)) out[m[1]] = m[2];
  for (const m of src.matchAll(/^\s*"([^"]+)"\s*:\s*`([^`]*)`/gm)) out[m[1]] = m[2];
  return out;
}

async function load(file) {
  if (localDir) return fs.readFileSync(path.join(localDir, 'src/i18n', file), 'utf8');
  const r = await fetch(RAW + file);
  if (!r.ok) throw new Error(`fetch ${file}: HTTP ${r.status}`);
  return r.text();
}

/* The parser is regex-based, so a refactor in the app (a nested object, a different quote
 * style, a computed key) could make it silently match far less. Emitting that would delete
 * hundreds of keys from en.json and tell every translator their work is "unknown". Refuse. */
function checkSane(en, sources) {
  const n = Object.keys(en).length;
  if (n < MIN_KEYS) {
    console.error(`✗ parsed only ${n} keys from ${sources.join(' + ')} (expected >= ${MIN_KEYS}).`);
    console.error(`  The app's dictionary format probably changed and this parser missed it.`);
    console.error(`  REFUSING to write en.json — emitting it would erase the translators' list.`);
    process.exit(2);
  }
  const cur = fs.existsSync(EN_JSON) ? JSON.parse(fs.readFileSync(EN_JSON, 'utf8')) : {};
  const lost = Object.keys(cur).filter(k => !(k in en));
  if (lost.length > 20) {
    console.error(`✗ regenerating would DROP ${lost.length} keys currently in en.json, e.g.`, lost.slice(0, 8));
    console.error(`  That is a lot to lose in one go. Either the app removed them on purpose`);
    console.error(`  (then raise this limit for one run) or the parser broke. REFUSING.`);
    process.exit(2);
  }
  return lost;
}

const EN_JSON = path.join(__dirname, 'en.json');

(async () => {
  const dicts = [];
  for (const f of FILES) dicts.push(parseDict(await load(f)));
  const EN = Object.assign(Object.create(null), ...dicts);   // { ...EN_BASE, ...SEED }
  const lost = checkSane(EN, FILES);

  const cur = fs.existsSync(EN_JSON) ? JSON.parse(fs.readFileSync(EN_JSON, 'utf8')) : {};
  // Existing keys keep their position AND their value (see "won't touch" above);
  // only genuinely-new keys are appended, with the app's English.
  const next = {};
  for (const k of Object.keys(cur)) if (k in EN) next[k] = cur[k];
  for (const k of Object.keys(EN)) if (!(k in next)) next[k] = EN[k];

  const added = Object.keys(next).filter(k => !(k in cur));
  const reworded = Object.keys(cur).filter(k => k in EN && cur[k] !== EN[k]);
  const body = JSON.stringify(next, null, 2) + '\n';
  // Compare with line endings normalised: git checks this file out as CRLF on Windows,
  // and we always emit LF, so a raw compare would report "changed" on every single run.
  const norm = (s) => s.replace(/\r\n/g, '\n');
  const same = fs.existsSync(EN_JSON) && norm(fs.readFileSync(EN_JSON, 'utf8')) === body;

  console.log(`app EN: ${Object.keys(EN).length} keys (${FILES.join(' + ')})`);
  console.log(`en.json: ${Object.keys(cur).length} -> ${Object.keys(next).length}`);
  if (added.length) console.log(`  + ${added.length} added`);
  if (lost.length)  console.log(`  - ${lost.length} in en.json but no longer in the app (kept)`);

  if (reworded.length && check) {
    // One line in CI. This is a standing editorial difference, not a regression, and
    // twenty lines of it on every run is how a check gets tuned out.
    console.log(`\n⚠ ${reworded.length} key(s) are worded differently here than in the app` +
      ` (not a failure — run without --check to see them).`);
  } else if (reworded.length) {
    console.log(`\n⚠ ${reworded.length} key(s) whose English differs from the app. NOT changed —`);
    console.log(`  rewording is an editorial call, and one of these is the privacy policy.`);
    console.log(`  Review and apply by hand if you want en.json to match what users see:`);
    for (const k of reworded.slice(0, 6)) {
      console.log(`    ${k}`);
      console.log(`      en.json: ${JSON.stringify(cur[k]).slice(0, 58)}`);
      console.log(`      app    : ${JSON.stringify(EN[k]).slice(0, 58)}`);
    }
    if (reworded.length > 6) console.log(`    … and ${reworded.length - 6} more`);
  }

  if (check) {
    // Only MISSING keys fail the build. A missing key is invisible to translators and so
    // renders English in every language — that is the drift this whole script exists to
    // stop. A reworded key is already translated and merely phrased differently; failing
    // CI over an editorial difference would train everyone to ignore this check.
    if (!added.length) { console.log('\n✓ en.json has every key the app can request.'); process.exit(0); }
    console.error(`\n✗ en.json is missing ${added.length} key(s) the app uses:`);
    console.error(`  ${added.slice(0, 8).join(', ')}${added.length > 8 ? ', …' : ''}`);
    console.error('  Translators cannot translate a string they were never shown, so these');
    console.error('  render in English for EVERY language. Fix: node sync-en.js && commit.');
    process.exit(1);
  }

  if (same) { console.log('\n✓ nothing to add.'); return; }
  fs.writeFileSync(EN_JSON, body);
  console.log(`\n✓ wrote en.json (+${added.length})`);
})().catch(e => { console.error('✗', e.message); process.exit(2); });
