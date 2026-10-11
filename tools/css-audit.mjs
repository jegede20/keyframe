#!/usr/bin/env node
/**
 * CSS coverage audit — the check that keeps the stylesheets honest.
 *
 * Compares the `kf-*` classes the components apply with the ones the
 * stylesheets (and the `<style>` blocks some components carry) define:
 *
 *   USED, NOT DEFINED  → a real visual bug (element renders unstyled)
 *   DEFINED, NOT USED  → dead CSS (safe to delete, but review first)
 *
 * Element ids (`id="kf-main-url"`) and test hooks are classified separately so
 * they never masquerade as missing classes.
 *
 *   node tools/css-audit.mjs            # report
 *   node tools/css-audit.mjs --strict   # exit 1 if a class is used but undefined
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const STYLE_FILES = ['src/styles/reset.css', 'src/styles/globals.css', 'src/styles/animations.css'];
const STRICT = process.argv.includes('--strict');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(SRC);
const codeFiles = files.filter((f) => ['.jsx', '.js'].includes(extname(f)) && !f.includes('/styles/'));

const CLASS_RE = /\bkf-[a-z0-9-]+\b/gi;

/* ── Classes the components APPLY (className / classList / clsx-ish) ─────── */
const used = new Map();
/* ── Tokens that are really element ids or test hooks — reported separately ─ */
const idLike = new Map();
/* ── Selectors defined inside component <style> blocks ──────────────────── */
const defined = new Map();
const dynamicPrefixes = new Set();

function add(map, name, where) {
  if (!map.has(name)) map.set(name, new Set());
  map.get(name).add(where);
}

function collectSelectors(text, where) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const chunk of stripped.split('}')) {
    // Everything up to the LAST '{' in a chunk is selector text — this is what
    // keeps nested @media rules (which contain two '{') from being skipped.
    const cut = chunk.lastIndexOf('{');
    if (cut === -1) continue;
    const selector = chunk.slice(0, cut);
    if (!selector.includes('kf-')) continue;
    for (const match of selector.match(CLASS_RE) || []) add(defined, match.toLowerCase(), where);
  }
}

for (const rel of STYLE_FILES) collectSelectors(readFileSync(join(ROOT, rel), 'utf8'), rel);

for (const file of codeFiles) {
  const text = readFileSync(file, 'utf8');
  const short = file.replace(ROOT, '');

  // <style>{`...`}</style> blocks count as definitions, not usages
  const styleBlocks = [...text.matchAll(/<style>\{?`?([\s\S]*?)`?\}?<\/style>/g)].map((m) => m[1]);
  styleBlocks.forEach((block) => collectSelectors(block, `${short} <style>`));
  const styleText = styleBlocks.join('\n');

  const withoutStyles = text.replace(/<style>[\s\S]*?<\/style>/g, '');

  for (const match of withoutStyles.matchAll(new RegExp(CLASS_RE.source, 'gi'))) {
    const name = match[0].toLowerCase();
    const tail = withoutStyles.slice(match.index + match[0].length, match.index + match[0].length + 4);
    if (tail.startsWith('${') || tail.startsWith('-${')) {
      // kf-bento-${card.size} — the regex stops at the dash, so re-add it
      dynamicPrefixes.add(name + (tail.startsWith('-${') ? '-' : ''));
      continue;
    }
    const before = withoutStyles.slice(Math.max(0, match.index - 22), match.index);
    if (/(id=|getElementById\(|htmlFor=)["'`{]?$/.test(before)) {
      add(idLike, name, short);
    } else {
      add(used, name, short);
    }
  }
  // selectors that only exist in the component's own <style> block are defined
  if (styleText) {
    // (already collected above — nothing more to do)
  }
}

/* ── Compare ────────────────────────────────────────────────────────────── */
const ALLOW_UNSTYLED = new Set([
  'kf-tab', // styled through aria-selected
]);

const usedNotDefined = [...used.keys()].filter((c) => !defined.has(c)).sort();
const dynamicDefined = [...defined.keys()]
  .filter((c) => !used.has(c) && [...dynamicPrefixes].some((p) => c.startsWith(p)))
  .sort();
const definedNotUsed = [...defined.keys()]
  .filter((c) => !used.has(c) && !idLike.has(c) && !dynamicDefined.includes(c))
  .sort();
const stateHooks = usedNotDefined.filter((c) => ALLOW_UNSTYLED.has(c));
const realGaps = usedNotDefined.filter((c) => !ALLOW_UNSTYLED.has(c));

console.log(`CSS audit — ${codeFiles.length} code files, ${STYLE_FILES.length} stylesheets + component <style> blocks`);
console.log(`  classes applied:   ${used.size}`);
console.log(`  classes defined:   ${defined.size}`);
console.log(`  id-shaped tokens:  ${idLike.size} (excluded)`);

console.log(`\nUSED, NOT DEFINED (${realGaps.length}):`);
if (realGaps.length === 0) console.log('  none ✓');
for (const c of realGaps) console.log(`  ${c}  ← ${[...used.get(c)].join(', ')}`);
if (stateHooks.length) console.log(`  (allow-listed state hooks: ${stateHooks.join(', ')})`);

if (dynamicPrefixes.size) console.log(`  dynamic families:  ${[...dynamicPrefixes].join(', ')}*`);
if (dynamicDefined.length) console.log(`  (covered by a dynamic family: ${dynamicDefined.join(', ')})`);

console.log(`\nDEFINED, NOT USED (${definedNotUsed.length}):`);
if (definedNotUsed.length === 0) console.log('  none ✓');
for (const c of definedNotUsed) console.log(`  ${c}  (${[...defined.get(c)].join(', ')})`);

if (STRICT && realGaps.length) {
  console.log('\nFAIL: components apply classes no stylesheet defines.');
  process.exit(1);
}
console.log('\naudit clean.');
