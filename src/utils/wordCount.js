/* ═══════════════════════════════════════════════════════════════════════════
   WORD COUNT — Section 6.3 rule 4
   Human speech ≈ 130 words/minute → a 10-second shot holds ~22 words.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WORDS_PER_MINUTE = 130;

/** Strips stage directions like "(click Export)" so they don't count as speech. */
function speechOnly(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ') // [PAUSE]
    .replace(/\([^)]*\)/g, ' ') // (click Export)
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text) {
  const clean = speechOnly(text);
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

/** Max speakable words for a shot of `durationSeconds`. */
export function maxWordsForDuration(durationSeconds) {
  const seconds = Math.max(0, Number(durationSeconds) || 0);
  return Math.floor((seconds / 60) * WORDS_PER_MINUTE);
}

/** Estimated spoken seconds for a line of narration. */
export function narrationSeconds(text) {
  return (countWords(text) / WORDS_PER_MINUTE) * 60;
}

/** { words, max, over, seconds, fits } for one narrator line. */
export function checkNarration(narration, durationSeconds) {
  const words = countWords(narration);
  const max = maxWordsForDuration(durationSeconds);
  return {
    words,
    max,
    over: Math.max(0, words - max),
    seconds: Math.round(narrationSeconds(narration)),
    fits: words <= max,
  };
}

/** Aggregate word stats for a whole script (used by the stats bar). */
export function scriptWordStats(script) {
  const shots = Array.isArray(script) ? script : [];
  const rows = shots.map((shot) => ({
    shotNumber: shot.shotNumber,
    ...checkNarration(shot.narration, shot.durationSeconds),
  }));
  return {
    rows,
    totalWords: rows.reduce((sum, r) => sum + r.words, 0),
    overflowing: rows.filter((r) => !r.fits),
  };
}
