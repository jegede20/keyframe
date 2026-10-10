/* Plain-text formatting used by every copy button (single source of truth). */

export function formatShot(shot) {
  return [
    `SHOT ${shot.shotNumber} — ${shot.label || ''}`.trim(),
    `${shot.timeStart}–${shot.timeEnd} (${shot.durationSeconds}s) · Screen: ${shot.screen}`,
    `Action: ${shot.action}`,
    `Say: "${shot.narration}"`,
  ].join('\n');
}

export function formatScript(output) {
  const meta = output?.meta || {};
  const lines = [
    `KEYFRAME DEMO SCRIPT — ${meta.appName || 'Your app'}`,
    meta.appPurpose ? `${meta.appPurpose}` : '',
    `Total: ${meta.totalSeconds}s · ${meta.shotCount || output?.script?.length || 0} shots · ~${meta.estimatedWordCount || 0} words · Tone: ${meta.tone || 'professional'}`,
    '─'.repeat(52),
    '',
  ].filter((line) => line !== '' || true);

  (output?.script || []).forEach((shot) => {
    lines.push(formatShot(shot), '');
  });

  return lines.join('\n').trim();
}

export function formatCutList(output) {
  const items = output?.cutList || [];
  const lines = [
    `CUT LIST — ${items.length} screen${items.length === 1 ? '' : 's'} left out`,
    '─'.repeat(52),
    '',
  ];
  items.forEach((item) => {
    lines.push(`⊘ ${item.screenName}`, `   Reason: ${item.reason}`, '');
  });
  return lines.join('\n').trim();
}

export function formatVideoPrompt(output) {
  const prompt = output?.videoPrompt || {};
  return [
    `VIDEO AI PROMPT — target: ${prompt.target || 'any'} · length: ${output?.meta?.totalSeconds || 0}s`,
    '─'.repeat(52),
    '',
    prompt.fullPrompt || '',
  ].join('\n').trim();
}

/** The "Copy All" payload: script + cut list + video prompt in one block. */
export function formatFullOutput(output) {
  if (!output) return '';
  return [
    formatScript(output),
    '',
    '═'.repeat(52),
    '',
    formatCutList(output),
    '',
    '═'.repeat(52),
    '',
    formatVideoPrompt(output),
  ].join('\n');
}

export function outputFilename(output) {
  const name = (output?.meta?.appName || 'keyframe-script')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${name || 'keyframe-script'}-${stamp}.txt`;
}
