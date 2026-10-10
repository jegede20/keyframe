import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_LAST_INPUTS, KF_KEYS, readLastInputs, writeJSON } from '../store/storage.js';

/**
 * Section 7 — the app has exactly 5 states. No routing. One canvas.
 * 'empty' | 'loading' | 'results' | 'error' | 'history'
 */
export const STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
  HISTORY: 'history',
};

export default function useAppState() {
  const [state, setStateRaw] = useState(STATES.EMPTY);
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);
  const [input, setInput] = useState(() => ({ ...DEFAULT_LAST_INPUTS, ...readLastInputs() }));
  const [lastGeneration, setLastGeneration] = useState(null);
  const [editing, setEditing] = useState(false);

  const setState = useCallback((next) => {
    setStateRaw(next);
    // Entering empty/results means we're not editing any more.
    if (next === STATES.EMPTY || next === STATES.RESULTS) setEditing(false);
  }, []);

  /** Inputs are always persisted so the next visit restores them (spec §4B-46). */
  const persistInput = useCallback((patch) => {
    setInput((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(KF_KEYS.lastInputs, { ...next, savedAt: new Date().toISOString() });
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setStateRaw(STATES.EMPTY);
    setOutput(null);
    setError(null);
    setLastGeneration(null);
    setEditing(false);
  }, []);

  const api = useMemo(
    () => ({
      state,
      output,
      input,
      error,
      lastGeneration,
      editing,
      isEditing: editing,
      setState,
      setOutput,
      setError,
      setInput: persistInput,
      setInputSilent: setInput,
      setLastGeneration,
      setEditing,
      reset,
    }),
    [state, output, input, error, lastGeneration, editing, setState, persistInput, reset]
  );

  return api;
}
