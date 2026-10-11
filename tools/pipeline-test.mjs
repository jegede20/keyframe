/* ═══════════════════════════════════════════════════════════════════════════
   PHASE 3 PIPELINE TEST — Step 33
   Runs the exact service modules the browser runs, with browser globals stubbed.
   Usage:
     node tools/run-pipeline-test.mjs                     (prompt/parse/repair only)
     GROQ_API_KEY=gsk_... node tools/run-pipeline-test.mjs (adds live Groq checks)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Browser globals the services expect ───────────────────────────────── */
globalThis.window = globalThis;

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  get length() {
    return memory.size;
  },
  key: (i) => [...memory.keys()][i] ?? null,
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true, userAgent: 'node-pipeline-test', platform: 'test', maxTouchPoints: 0 },
    configurable: true,
    writable: true,
  });
} catch (err) {
  /* navigator already writable */
}
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = { now: () => Date.now() };
}

const { fetchAndCleanJina, cleanMarkdown, extractSections, isValidUrl } = await import('../src/services/jina.js');
const { buildFullPrompt, buildContextLayer, buildParametersLayer, SYSTEM_PROMPT, OUTPUT_SCHEMA } = await import('../src/services/promptBuilder.js');
const { parseAndValidateOutput } = await import('../src/services/outputParser.js');
const { GroqError, classifyGroqStatus, normalizeError } = await import('../src/services/errorClassifier.js');
const { secondsToTimestamp, repairTimings, sumDurations, getShotRange, timestampToSeconds } = await import('../src/utils/timing.js');
const { countWords, maxWordsForDuration, scriptWordStats } = await import('../src/utils/wordCount.js');

/* ── Tiny test runner ──────────────────────────────────────────────────── */
let pass = 0;
let fail = 0;
let skip = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function skipped(name, why) {
  skip += 1;
  console.log(`  ⏭️  ${name} — ${why}`);
}
function section(title) {
  console.log(`\n${title}`);
}

/* ═══ 1. URL helpers ════════════════════════════════════════════════════ */
section('1. URL normalisation + validation');
check('bare domain is valid', isValidUrl('stripe.com'));
check('full https URL is valid', isValidUrl('https://dashboard.stripe.com/payments'));
check('http URL is valid', isValidUrl('http://example.com'));
check('garbage rejected', !isValidUrl('not a url'));
check('empty rejected', !isValidUrl(''));
check('javascript: rejected', !isValidUrl('javascript:alert(1)'));

/* ═══ 2. Markdown cleaner ═══════════════════════════════════════════════ */
section('2. Markdown cleaner (all six passes)');
const messy = [
  '# Pricing',
  '',
  '',
  '',
  'We use cookies to improve your experience. By clicking Accept you agree.',
  'Share on Twitter',
  '[Skip to content](#main-nav)',
  '## Real-time dashboards for every team',
  '## Real-time dashboards for every team',
  '## Real-time dashboards for every team',
  'Short',
  'Short',
  '### Export raw data with one click',
].join('\n');
const cleanedMessy = cleanMarkdown(messy);
check('blank-line runs collapsed', !/\n{3,}/.test(cleanedMessy));
check('cookie notice removed', !/cookies/i.test(cleanedMessy));
check('social share text removed', !/share on twitter/i.test(cleanedMessy));
check('anchor-only line removed', !/\]\(#main-nav\)/.test(cleanedMessy));
check(
  'duplicate long lines deduped',
  (cleanedMessy.match(/Real-time dashboards/g) || []).length === 1
);
check('short duplicate lines preserved', (cleanedMessy.match(/^Short$/gm) || []).length === 2);

/* Jina metadata preamble (Title:/URL Source:/Markdown Content:) */
const preambled = [
  'Title: Studio — Ship faster',
  'URL Source: https://studio.example.com/',
  'Published Time: 2026-01-14T09:00:00Z',
  'Markdown Content:',
  '# Studio',
  '',
  '## Board view',
  'Drag a card and every change lands in the shared workspace instantly for the team.',
].join('\n');
const cleanedPreamble = cleanMarkdown(preambled);
check('preamble Title: line stripped', !/^Title:/m.test(cleanedPreamble));
check('preamble URL Source: stripped', !/^URL Source:/m.test(cleanedPreamble));
check('preamble Markdown Content: marker stripped', !/^Markdown Content:/m.test(cleanedPreamble));
check('preamble strip keeps the real content', cleanedPreamble.startsWith('# Studio'), cleanedPreamble.slice(0, 24));
check('preamble strip keeps inner headings', extractSections(cleanedPreamble).includes('Board view'));

const inlinePreamble = cleanMarkdown('Title: Inline\nMarkdown Content: # Main heading\n\nBody copy that is long enough to survive the cleaning passes intact.');
check('inline "Markdown Content: # X" keeps the heading', inlinePreamble.startsWith('# Main heading'), inlinePreamble.slice(0, 24));

const midDoc = cleanMarkdown('# Docs\n\nIntro paragraph that is comfortably longer than the ten character dedupe floor.\n\nTitle: this is legitimate body text, not a preamble');
check('no false strip deeper in the document', /Title: this is legitimate/.test(midDoc));

const longText = `# H\n${'x'.repeat(60000)}`;
const capped = cleanMarkdown(longText);
const capTarget = 48000 + '\n\n[Content truncated]'.length;
check('48k character cap enforced', capped.length <= capTarget, `${capped.length} chars (cap ${capTarget})`);
check('truncation marker appended', /\[Content truncated\]/.test(capped));

const sectionsFromMessy = extractSections(cleanedMessy);
check('headings extracted', sectionsFromMessy.includes('Pricing') && sectionsFromMessy.includes('Export raw data with one click'), sectionsFromMessy.join(' | '));

/* ═══ 3. LIVE Jina read ═════════════════════════════════════════════════ */
section('3. Live Jina read of a real public page');
const candidates = [
  'https://tailwindcss.com/',
  'https://vitejs.dev/',
  'https://example.com/',
];
let jinaResult = null;
let jinaSource = null;
for (const candidate of candidates) {
  try {
    const result = await fetchAndCleanJina(candidate);
    jinaResult = result;
    jinaSource = candidate;
    break;
  } catch (err) {
    console.log(`  … ${candidate} failed: ${err.message}`);
  }
}
check('Jina returned cleaned content', Boolean(jinaResult?.cleaned), jinaSource || 'none');
if (jinaResult) {
  check('charCount > 200', jinaResult.charCount > 200, `${jinaResult.charCount} chars`);
  check('estimatedTokens ≈ chars/4', jinaResult.estimatedTokens === Math.ceil(jinaResult.charCount / 4), `~${jinaResult.estimatedTokens} tokens`);
  check('sections array present', Array.isArray(jinaResult.sections), `${jinaResult.sections.length} headings`);
  check('content under cap', jinaResult.charCount <= 48020);
  check('sourceUrl normalised', /^https?:\/\//.test(jinaResult.sourceUrl));
}

/* ═══ 4. Prompt builder — 4 layers ══════════════════════════════════════ */
section('4. Prompt builder (4 layers)');
if (jinaResult) {
  const inputs = { features: 'One-click export, real-time collab', length: 90, tone: 'professional', videoTool: 'runway' };
  const built = buildFullPrompt('https://example.com', inputs, jinaResult);
  check('two messages (system + user)', built.messages.length === 2);
  check('system role first', built.messages[0].role === 'system');
  check('system prompt intact', built.messages[0].content === SYSTEM_PROMPT);
  check('context layer present', built.messages[1].content.includes('=== APP CONTENT'));
  check('BEGIN/END fences present', built.messages[1].content.includes('--- BEGIN SCRAPED CONTENT ---') && built.messages[1].content.includes('--- END SCRAPED CONTENT ---'));
  check('parameters layer present', built.messages[1].content.includes('=== BRIEF ==='));
  check('shot range injected for 90s', built.messages[1].content.includes('7–9 shots'));
  check('tone guide injected', /Authoritative, clear, confident/.test(built.messages[1].content));
  check('video tool guide injected', /Camera movement first/.test(built.messages[1].content));
  check('output schema appended', built.messages[1].content.includes(OUTPUT_SCHEMA.slice(0, 40)));

  const ctxOnly = buildContextLayer(jinaResult, 'https://example.com');
  check('context layer lists sections', ctxOnly.includes('Detected sections/screens:'));
  const params = buildParametersLayer({ length: 30, tone: 'energetic', videoTool: 'pika' });
  check('30s → 3–4 shots', params.includes('3–4 shots'));
  check('energetic guide', /Exciting, fast, punchy/.test(params));
  check('pika guide', /Under 200 chars per scene/.test(params));
  const paramsRequired = buildParametersLayer({ requiredScreens: ['Billing', 'Team settings'] });
  check('required screens honoured', paramsRequired.includes('MUST INCLUDE THESE SCREENS') && paramsRequired.includes('Billing'));
}

/* ═══ 5. Timing helpers ════════════════════════════════════════════════ */
section('5. Timing utilities');
check('secondsToTimestamp(0) = 0:00', secondsToTimestamp(0) === '0:00');
check('secondsToTimestamp(95) = 1:35', secondsToTimestamp(95) === '1:35');
check('secondsToTimestamp(120) = 2:00', secondsToTimestamp(120) === '2:00');
check("timestampToSeconds('1:35') = 95", timestampToSeconds('1:35') === 95);
check('getShotRange(60)', getShotRange(60) === '5–7 shots');
check('getShotRange fallback', getShotRange(999) === '7–9 shots');

const wobbly = [
  { shotNumber: 1, durationSeconds: 12, narration: 'a'.repeat(1), screen: 'A', action: 'x' },
  { shotNumber: 2, durationSeconds: 31, narration: '', screen: 'B', action: 'y' },
  { shotNumber: 3, durationSeconds: 9, narration: '', screen: 'C', action: 'z' },
];
const repaired = repairTimings(wobbly, 90);
check('repaired sum === 90', sumDurations(repaired) === 90, `sum=${sumDurations(repaired)}`);
check('first shot starts 0:00', repaired[0].timeStart === '0:00');
check('last shot ends 1:30', repaired[repaired.length - 1].timeEnd === '1:30');
check('timings contiguous', repaired[1].timeStart === repaired[0].timeEnd && repaired[2].timeStart === repaired[1].timeEnd);

const alreadyGood = repairTimings([{ durationSeconds: 42 }, { durationSeconds: 48 }], 90);
check('exact input unchanged in duration', sumDurations(alreadyGood) === 90);
const zeroDurations = repairTimings([{ durationSeconds: 0 }, { durationSeconds: 0 }, { durationSeconds: 0 }], 90);
check('all-zero durations distributed', sumDurations(zeroDurations) === 90);

/* ═══ 6. Word count / speaking rate ════════════════════════════════════ */
section('6. Narration speaking-rate checks (130 wpm)');
check('10s shot → 21 words', maxWordsForDuration(10) === 21);
check('counts plain words', countWords('The dashboard shows every project in flight') === 7);
check('strips stage directions', countWords('(click Export) [PAUSE] Export now') === 2);
check('empty narration = 0', countWords('') === 0);
const stats = scriptWordStats([
  { shotNumber: 1, durationSeconds: 10, narration: Array(30).fill('word').join(' ') },
  { shotNumber: 2, durationSeconds: 20, narration: Array(40).fill('word').join(' ') },
]);
check('flags overflowing shot', stats.overflowing.length === 1 && stats.overflowing[0].shotNumber === 1);
check('total words summed', stats.totalWords === 70, `${stats.totalWords}`);

/* ═══ 7. Output parser — happy path ════════════════════════════════════ */
section('7. Output parser: valid payload');
const goodPayload = {
  meta: { appName: 'Acme', appPurpose: 'Project tracking.', totalSeconds: 60, shotCount: 6, estimatedWordCount: 120, tone: 'professional' },
  script: [
    { shotNumber: 1, label: 'OPENING', screen: 'Home', timeStart: '0:00', timeEnd: '0:10', durationSeconds: 10, action: 'Open the dashboard.', narration: 'Acme gives your team one place to see everything.' },
    { shotNumber: 2, label: 'FEATURE 1', screen: 'Boards', timeStart: '0:10', timeEnd: '0:25', durationSeconds: 15, action: 'Drag a card between columns.', narration: 'Drag any task and the whole board updates instantly for everyone.' },
    { shotNumber: 3, label: 'FEATURE 2', screen: 'Reports', timeStart: '0:25', timeEnd: '0:40', durationSeconds: 15, action: 'Filter by team.', narration: 'Filter by team and see where work is really piling up.' },
    { shotNumber: 4, label: 'CLOSING', screen: 'Pricing', timeStart: '0:40', timeEnd: '1:00', durationSeconds: 20, action: 'Scroll the pricing tiers.', narration: 'Start free, upgrade when the whole team moves in.' },
  ],
  cutList: [
    { screenName: 'Integrations', reason: 'Great depth but only two integrations matter to a first-time viewer.' },
    { screenName: 'Mobile app', reason: 'The desktop flow reads better on video; mobile is a second demo.' },
  ],
  videoPrompt: { target: 'runway', fullPrompt: 'A 60 second product demo of Acme. '.repeat(20) },
};
const parsedGood = parseAndValidateOutput(JSON.stringify(goodPayload));
check('parses valid JSON', parsedGood.meta.appName === 'Acme');
check('timings resum to 60', sumDurations(parsedGood.script) === 60);
check('last timeEnd is 1:00', parsedGood.script.at(-1).timeEnd === '1:00');
check('shotCount recomputed', parsedGood.meta.shotCount === 4);
check('word count recomputed', parsedGood.meta.estimatedWordCount > 0, `${parsedGood.meta.estimatedWordCount}`);

/* ═══ 8. Output parser — repair paths ══════════════════════════════════ */
section('8. Output parser: malformed input repair');
const fenced = '```json\n' + JSON.stringify(goodPayload) + '\n```';
check('```json fences stripped', parseAndValidateOutput(fenced).meta.appName === 'Acme');

const chatter = `Here is your script:\n${JSON.stringify(goodPayload)}\nHope it helps!`;
check('surrounding prose tolerated', parseAndValidateOutput(chatter).meta.appName === 'Acme');

const missingFields = JSON.stringify({
  ...goodPayload,
  script: [{ shotNumber: 1, screen: 'Home' }, { shotNumber: 2, durationSeconds: 20 }],
});
const repairedFields = parseAndValidateOutput(missingFields);
check("missing fields get placeholders (no crash)", repairedFields.script.length === 2);
check("placeholder narration is a string", typeof repairedFields.script[0].narration === "string");
check("placeholder action is a string", typeof repairedFields.script[1].action === "string");
check("placeholders flagged as warnings", repairedFields.__warnings.length >= 2, `${repairedFields.__warnings.length} warnings`);

const badCut = JSON.stringify({ ...goodPayload, cutList: 'oops' });
check('non-array cutList → []', Array.isArray(parseAndValidateOutput(badCut).cutList) && parseAndValidateOutput(badCut).cutList.length === 0);

const badPrompt = JSON.stringify({ ...goodPayload, videoPrompt: { target: 'pika' } });
check('missing fullPrompt → error string', /^ERROR:/.test(parseAndValidateOutput(badPrompt).videoPrompt.fullPrompt));

let threw = null;
try {
  parseAndValidateOutput('this is not json at all');
} catch (err) {
  threw = err;
}
check('unparseable → throws parse error', Boolean(threw) && /unparseable/i.test(threw.message));

threw = null;
try {
  const { script, ...rest } = goodPayload;
  parseAndValidateOutput(JSON.stringify(rest));
} catch (err) {
  threw = err;
}
check('missing section names the key', Boolean(threw) && /"script"/.test(threw.message), threw?.message);

const offTimings = JSON.stringify({
  ...goodPayload,
  script: goodPayload.script.map((s) => ({ ...s, durationSeconds: 30 })),
});
const fixedTimings = parseAndValidateOutput(offTimings);
check('wrong durations repaired to exact total', sumDurations(fixedTimings.script) === 60, `sum=${sumDurations(fixedTimings.script)}`);

/* ═══ 9. Error classification ══════════════════════════════════════════ */
section('9. Error classification');
const e401 = new GroqError(401, { error: { message: 'Invalid API Key' } });
const e429 = new GroqError(429, { error: { message: 'Rate limit reached' } });
const e503 = new GroqError(503, { error: { message: 'Service unavailable' } });
const e400 = new GroqError(400, { error: { message: 'bad payload' } });
const e500 = new GroqError(500, {});
check('401 → INVALID_API_KEY / RETRY', e401.type === 'INVALID_API_KEY' && e401.action === 'RETRY');
check('429 → RATE_LIMITED / RETRY', e429.type === 'RATE_LIMITED' && e429.action === 'RETRY');
check('503 → GROQ_DOWN / RETRY', e503.type === 'GROQ_DOWN' && e503.action === 'RETRY');
check('400 → BAD_REQUEST / EDIT_INPUTS', e400.type === 'BAD_REQUEST' && e400.action === 'EDIT_INPUTS');
check('other → UNKNOWN / RETRY', e500.type === 'UNKNOWN' && e500.action === 'RETRY');
check('401 message is specific', /rejected/i.test(e401.userMsg));
check('429 message mentions the shared quota', /quota/i.test(e429.userMsg));
const norm = normalizeError(e429);
check('normalizeError keeps type + action', norm.type === 'RATE_LIMITED' && norm.action === 'RETRY');
const normAbort = normalizeError(Object.assign(new Error('aborted'), { name: 'AbortError' }));
check('AbortError normalised', normAbort.type === 'ABORTED');

/* ═══ 10. Live Groq generation (key-gated) ═════════════════════════════ */
section('10. Live Groq generation');
const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
if (!groqKey.startsWith('gsk_') || !jinaResult) {
  skipped('90s generation → 7–9 shots', 'no GROQ_API_KEY env var (pass one to run live checks)');
  skipped('60s generation → 5–7 shots', 'no GROQ_API_KEY env var');
  skipped('cut list 2–8 items', 'no GROQ_API_KEY env var');
  skipped('tone produces different narration', 'no GROQ_API_KEY env var');
  skipped('fallback model on 429', 'requires live rate-limit conditions');
} else {
  const { generateWithFallback } = await import('../src/services/groq.js');
  const runs = [
    { length: 90, tone: 'professional', min: 7, max: 9 },
    { length: 60, tone: 'energetic', min: 5, max: 7 },
  ];
  for (const run of runs) {
    try {
      const res = await generateWithFallback(
        jinaSource,
        { features: 'Dashboards, search, pricing', length: run.length, tone: run.tone, videoTool: 'any' },
        jinaResult,
        groqKey
      );
      const shots = res.output.script;
      check(`${run.length}s → shots in range`, shots.length >= run.min && shots.length <= run.max, `${shots.length} shots`);
      check(`${run.length}s durations sum exactly`, sumDurations(shots) === run.length, `sum=${sumDurations(shots)}`);
      check(`${run.length}s first shot 0:00`, shots[0].timeStart === '0:00');
      check(`${run.length}s last shot ends on total`, shots.at(-1).timeEnd === secondsToTimestamp(run.length));
      const over = scriptWordStats(shots).overflowing;
      check(`${run.length}s narration fits speaking rate`, over.length === 0, over.map((o) => `shot ${o.shotNumber}: ${o.words}/${o.max}w`).join(', '));
      check(`${run.length}s cut list 2–8 items`, res.output.cutList.length >= 2 && res.output.cutList.length <= 8, `${res.output.cutList.length} items`);
      check(`${run.length}s video prompt 300–600 words`, countWords(res.output.videoPrompt.fullPrompt) >= 250, `${countWords(res.output.videoPrompt.fullPrompt)} words`);
      const opener = shots[0].narration.toLowerCase();
      check(`${run.length}s no filler opening`, !/(in this video|welcome to)/.test(opener), `"${shots[0].narration.slice(0, 60)}…"`);
    } catch (err) {
      check(`${run.length}s live generation`, false, err.message);
    }
  }
}

/* ═══ Summary ══════════════════════════════════════════════════════════ */
console.log('\n' + '─'.repeat(64));
console.log(`Phase 3 pipeline test: ${pass} passed, ${fail} failed, ${skip} skipped`);
if (failures.length) {
  console.log('Failures:\n  - ' + failures.join('\n  - '));
}
console.log('─'.repeat(64));
process.exit(fail > 0 ? 1 : 0);
