#!/usr/bin/env node
/**
 * Lighthouse acceptance run — the four criteria from the spec.
 *
 *   npm run build && npm run preview -- --port 4173   # serve the prod build
 *   npm run lighthouse
 *
 * Runs three passes (Lighthouse is noisy on a shared CPU) and reports the
 * median, then fails if any acceptance threshold is missed:
 *   PWA 100 · accessibility ≥ 95 · LCP < 2.5s · CLS < 0.1
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.LH_URL || 'http://localhost:4173/';
const PASSES = Number(process.env.LH_PASSES || 3);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const runs = [];
for (let i = 1; i <= PASSES; i += 1) {
  const out = join(tmpdir(), `kf-lh-${process.pid}-${i}.json`);
  console.log(`\n▸ Lighthouse pass ${i}/${PASSES} …`);
  const res = spawnSync(
    'npx',
    ['lighthouse', URL, '--only-categories=performance,accessibility,best-practices,pwa',
     '--output=json', `--output-path=${out}`, '--quiet', '--max-wait-for-load=60000',
     '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage'],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );
  if (!existsSync(out)) {
    console.error('Lighthouse produced no report — is the preview server running on', URL, '?');
    process.exit(2);
  }
  const d = JSON.parse(readFileSync(out, 'utf8'));
  const a = d.audits;
  runs.push({
    perf: Math.round(d.categories.performance.score * 100),
    a11y: Math.round(d.categories.accessibility.score * 100),
    bp: Math.round(d.categories['best-practices'].score * 100),
    pwa: Math.round(d.categories.pwa.score * 100),
    lcp: a['largest-contentful-paint'].numericValue / 1000,
    fcp: a['first-contentful-paint'].numericValue / 1000,
    cls: a['cumulative-layout-shift'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
  });
  rmSync(out, { force: true });
  const r = runs.at(-1);
  console.log(`  perf ${r.perf} · a11y ${r.a11y} · bp ${r.bp} · pwa ${r.pwa} | LCP ${r.lcp.toFixed(2)}s CLS ${r.cls.toFixed(3)} TBT ${r.tbt.toFixed(0)}ms`);
}

const m = {
  perf: median(runs.map((r) => r.perf)),
  a11y: median(runs.map((r) => r.a11y)),
  bp: median(runs.map((r) => r.bp)),
  pwa: median(runs.map((r) => r.pwa)),
  lcp: median(runs.map((r) => r.lcp)),
  cls: median(runs.map((r) => r.cls)),
  tbt: median(runs.map((r) => r.tbt)),
};

console.log('\n── median of', PASSES, 'passes ──');
console.log(`  performance ${m.perf} · accessibility ${m.a11y} · best-practices ${m.bp} · PWA ${m.pwa}`);
console.log(`  LCP ${m.lcp.toFixed(2)}s · CLS ${m.cls.toFixed(3)} · TBT ${m.tbt.toFixed(0)}ms`);

const checks = [
  ['PWA 100', m.pwa === 100],
  ['accessibility ≥ 95', m.a11y >= 95],
  ['LCP < 2.5s', m.lcp < 2.5],
  ['CLS < 0.1', m.cls < 0.1],
];
let failed = 0;
console.log('');
for (const [label, ok] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}
process.exit(failed ? 1 : 0);
