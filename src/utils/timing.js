/* ═══════════════════════════════════════════════════════════════════════════
   TIMING UTILITIES — Section 6.4
   ═══════════════════════════════════════════════════════════════════════════ */

/** secondsToTimestamp(95) → '1:35' */
export function secondsToTimestamp(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** '1:35' | '95' | '95s' → 95 (returns null when unparseable) */
export function timestampToSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?s?$/.test(trimmed)) return Math.round(parseFloat(trimmed));
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  return null;
}

export function sumDurations(shots) {
  return (shots || []).reduce(
    (total, shot) => total + (Number(shot?.durationSeconds) || 0),
    0
  );
}

/**
 * repairTimings(shots, totalSeconds)
 * Guarantees: sum(durations) === totalSeconds, timings contiguous from 0:00,
 * and every timeStart/timeEnd recomputed sequentially.
 */
export function repairTimings(shots, totalSeconds) {
  const list = Array.isArray(shots) ? shots.map((s) => ({ ...s })) : [];
  if (list.length === 0) return list;

  const target = Math.max(1, Math.round(Number(totalSeconds) || 0));
  const currentSum = sumDurations(list);

  if (currentSum === target) {
    return recalculateTimestamps(list);
  }

  if (currentSum === 0) {
    // Nothing usable — split evenly, remainder on the last shot.
    const base = Math.floor(target / list.length);
    const remainder = target - base * list.length;
    list.forEach((shot, i) => {
      shot.durationSeconds = base + (i === list.length - 1 ? remainder : 0);
    });
    return recalculateTimestamps(list);
  }

  // Distribute the diff proportionally, then square up the remainder on the last shot.
  const ratio = target / currentSum;
  list.forEach((shot) => {
    shot.durationSeconds = Math.max(
      1,
      Math.round((Number(shot.durationSeconds) || 1) * ratio)
    );
  });

  let drift = target - sumDurations(list);
  if (drift !== 0) {
    const perShot = Math.trunc(drift / list.length);
    if (perShot !== 0) {
      list.forEach((shot) => {
        shot.durationSeconds = Math.max(1, shot.durationSeconds + perShot);
      });
      drift = target - sumDurations(list);
    }
    const last = list[list.length - 1];
    last.durationSeconds = Math.max(1, last.durationSeconds + drift);
  }

  // Final safety net: force an exact sum by nudging the largest shot.
  let finalDrift = target - sumDurations(list);
  if (finalDrift !== 0) {
    let biggest = 0;
    list.forEach((shot, i) => {
      if (shot.durationSeconds > list[biggest].durationSeconds) biggest = i;
    });
    list[biggest].durationSeconds = Math.max(1, list[biggest].durationSeconds + finalDrift);
    finalDrift = target - sumDurations(list);
    if (finalDrift !== 0) {
      list[list.length - 1].durationSeconds = Math.max(
        1,
        list[list.length - 1].durationSeconds + finalDrift
      );
    }
  }

  return recalculateTimestamps(list);
}

/** Walks the list from 0:00 writing timeStart/timeEnd for every shot. */
export function recalculateTimestamps(shots) {
  let cursor = 0;
  return (shots || []).map((shot, index) => {
    const duration = Math.max(1, Math.round(Number(shot.durationSeconds) || 1));
    const timeStart = secondsToTimestamp(cursor);
    const timeEnd = secondsToTimestamp(cursor + duration);
    cursor += duration;
    return {
      ...shot,
      shotNumber: Number(shot.shotNumber) || index + 1,
      durationSeconds: duration,
      timeStart,
      timeEnd,
    };
  });
}

/** Section 3 — shot count must track the requested duration. */
export const SHOT_RANGES = {
  30: '3–4 shots',
  60: '5–7 shots',
  90: '7–9 shots',
  120: '9–12 shots',
};

export function getShotRange(length) {
  return SHOT_RANGES[length] || SHOT_RANGES[90];
}

export function getShotBounds(length) {
  const map = {
    30: [3, 4],
    60: [5, 7],
    90: [7, 9],
    120: [9, 12],
  };
  return map[length] || map[90];
}

export function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
