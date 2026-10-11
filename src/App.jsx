import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Plus, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/* layout */
import Navbar from './components/layout/Navbar.jsx';
import BottomBar from './components/layout/BottomBar.jsx';
import ToastContainer from './components/shared/ToastContainer.jsx';

/* landing */
import Hero from './components/landing/Hero.jsx';
import TrustBar from './components/landing/TrustBar.jsx';
import HowItWorks from './components/landing/HowItWorks.jsx';
import BentoGrid from './components/landing/BentoGrid.jsx';
import OutputPreview from './components/landing/OutputPreview.jsx';
import FAQ from './components/landing/FAQ.jsx';
import Footer from './components/landing/Footer.jsx';

/* input */
import InputCard from './components/input/InputCard.jsx';
import InputSummary from './components/input/InputSummary.jsx';

/* loading */
import LoadingStepper from './components/loading/LoadingStepper.jsx';

/* results */
import ResultsTabs from './components/results/ResultsTabs.jsx';
import ErrorBox from './components/shared/ErrorBox.jsx';

/* overlays */
import HistoryDrawer from './components/overlays/HistoryDrawer.jsx';
import SettingsModal from './components/overlays/SettingsModal.jsx';
import ConfirmDialog from './components/overlays/ConfirmDialog.jsx';
import InstallPrompt from './components/shared/InstallPrompt.jsx';
import UpdateBanner from './components/shared/UpdateBanner.jsx';

/* hooks */
import useAppState, { STATES } from './hooks/useAppState.js';
import useSettings from './hooks/useSettings.js';
import useHistory from './hooks/useHistory.js';
import { ToastProvider, useToastSafe } from './hooks/useToast.js';
import useOnlineStatus from './hooks/useOnlineStatus.js';
import usePWAInstall from './hooks/usePWAInstall.js';

/* services */
import { fetchAndCleanJina, isValidUrl, normalizeUrl } from './services/jina.js';
import { generateWithFallback, resolveApiKey } from './services/groq.js';
import { normalizeError } from './services/errorClassifier.js';
import { formatFullOutput } from './utils/formatScript.js';
import { readJSON, KF_KEYS } from './store/storage.js';

function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHELL — everything inside the toast provider
   ═══════════════════════════════════════════════════════════════════════════ */
function Shell({ settings, updateSetting, history, isOnline, pwa, appState }) {
  const { toasts, addToast, removeToast } = useToastSafe();

  const {
    state,
    output,
    input,
    error,
    setState,
    setOutput,
    setError,
    setInput,
    setLastGeneration,
    lastGeneration,
    editing,
    setEditing,
    reset,
  } = appState;

  /* ── Overlays ────────────────────────────────────────────────────────── */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [installBannerHidden, setInstallBannerHidden] = useState(false);
  const [inWorkspace, setInWorkspace] = useState(false);

  /* ── Generation ──────────────────────────────────────────────────────── */
  const [activeStep, setActiveStep] = useState(0);
  const [regeneratingScreen, setRegeneratingScreen] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const jinaAbort = useRef(null);
  const groqAbort = useRef(null);
  const stepTimers = useRef([]);
  const workRef = useRef(null);

  /* ── PWA shortcut deep links ─────────────────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'history') setHistoryOpen(true);
    if (action === 'new') reset();
    if (action) window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Back-online notice ──────────────────────────────────────────────── */
  useEffect(() => {
    const onBack = () => addToast('Back online — ready when you are.', 'success');
    window.addEventListener('keyframe-back-online', onBack);
    return () => window.removeEventListener('keyframe-back-online', onBack);
  }, [addToast]);

  /* ── Stepper pacing (5 steps spread over the request) ────────────────── */
  const clearStepTimers = useCallback(() => {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
  }, []);

  const startStepper = useCallback(() => {
    clearStepTimers();
    setActiveStep(0);
    [2600, 7000, 11000, 14000].forEach((delay, index) => {
      stepTimers.current.push(setTimeout(() => setActiveStep(index + 1), delay));
    });
  }, [clearStepTimers]);

  useEffect(() => clearStepTimers, [clearStepTimers]);

  /* Scroll the workspace into view whenever a generation starts. */
  useEffect(() => {
    if (state !== STATES.LOADING) return;
    const t = setTimeout(() => {
      const el = workRef.current;
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [state]);

  /* ── GENERATE ────────────────────────────────────────────────────────── */
  const runGeneration = useCallback(
    async (extra = {}) => {
      const url = normalizeUrl(input.url);
      const features = String(input.features || '');

      if (!isValidUrl(url)) {
        addToast("That URL doesn't look valid — check it and try again.", 'error');
        return;
      }
      if (!features.trim()) {
        if (!inWorkspace) {
          // Hero entry point: drop into the workspace and ask for the features.
          setInWorkspace(true);
          addToast('Add the features you want to highlight, then hit Generate Script.', 'info');
          setTimeout(() => document.getElementById('kf-main-features')?.focus(), 300);
        } else {
          addToast('Add at least one feature to highlight.', 'error');
          document.getElementById('kf-main-features')?.focus();
        }
        return;
      }
      if (!isOnline) {
        addToast("You're offline — generation needs a connection.", 'error');
        return;
      }

      setError(null);
      setEditing(false);
      setState(STATES.LOADING);
      startStepper();

      try {
        /* Reading the URL (steps 1–2) */
        jinaAbort.current = new AbortController();
        const jinaResult = await fetchAndCleanJina(url, { signal: jinaAbort.current.signal });

        /* Writing the script (steps 3–5) */
        groqAbort.current = new AbortController();
        const { key } = resolveApiKey();
        const userInputs = {
          features,
          length: input.length,
          tone: input.tone,
          videoTool: input.videoTool,
          requiredScreens: extra.requiredScreens || [],
          extraInstruction: extra.extraInstruction || '',
        };

        const result = await generateWithFallback(url, userInputs, jinaResult, key, {
          signal: groqAbort.current.signal,
          onModelSwitch: (from, to) => addToast(`Primary model busy — switched to ${to}.`, 'info'),
        });

        setActiveStep(5);
        clearStepTimers();

        const generation = {
          model: result.model,
          inputTokens: result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? 0,
          generationMs: result.generationMs,
        };

        setOutput(result.output);
        setLastGeneration(generation);
        setState(STATES.RESULTS);
        setRegeneratingScreen(null);
        addToast(
          `Draft ready — ${result.output.meta.shotCount} shots, ${result.output.meta.totalSeconds}s.`,
          'success'
        );
        if (extra.requiredScreens?.length) {
          addToast(`${extra.requiredScreens.join(', ')} added to the script.`, 'success');
        }
      } catch (err) {
        clearStepTimers();
        if (err?.name === 'AbortError') return;
        console.error('[Keyframe] Generation failed:', err);
        setError(normalizeError(err));
        setState(STATES.ERROR);
        setRegeneratingScreen(null);
      }
    },
    [
      input,
      isOnline,
      inWorkspace,
      addToast,
      setError,
      setState,
      setOutput,
      setLastGeneration,
      setEditing,
      startStepper,
      clearStepTimers,
    ]
  );

  /* ── "+ Add to Script" re-generation ─────────────────────────────────── */
  const addScreenToScript = useCallback(
    async (screenName) => {
      setRegeneratingScreen(screenName);
      setEditing(false);
      await runGeneration({
        requiredScreens: [screenName],
        extraInstruction: `The user explicitly asked to include the "${screenName}" screen, which the previous cut list excluded. Give it its own shot.`,
      });
    },
    [runGeneration, setEditing]
  );

  /* ── CANCEL — aborts both fetches independently (Rule 7) ─────────────── */
  const cancelGeneration = useCallback(() => {
    jinaAbort.current?.abort();
    groqAbort.current?.abort();
    clearStepTimers();
    setRegeneratingScreen(null);
    setState(STATES.EMPTY);
    addToast('Generation cancelled — your inputs are untouched.', 'info');
  }, [clearStepTimers, setState, addToast]);

  /* ── COPY ALL ────────────────────────────────────────────────────────── */
  const copyAll = useCallback(async () => {
    const text = formatFullOutput(output);
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (err) {
        ok = fallbackCopy(text);
      }
    } else {
      ok = fallbackCopy(text);
    }
    setCopiedAll(ok);
    addToast(
      ok ? 'Script + cut list + video prompt copied.' : 'Copy failed — select the text manually.',
      ok ? 'success' : 'error'
    );
    setTimeout(() => setCopiedAll(false), 2000);
  }, [output, addToast]);

  /* ── NEW SCRIPT — auto-save to history first (Rule 10) ───────────────── */
  const newScript = useCallback(async () => {
    if (output) {
      try {
        await history.addToHistory({
          id: uuidv4(),
          input: { ...input, url: normalizeUrl(input.url) },
          output,
          createdAt: new Date().toISOString(),
          generation: lastGeneration || { model: 'unknown' },
        });
        addToast('Saved to history.', 'success');
      } catch (err) {
        console.warn('[Keyframe] Auto-save failed:', err);
        addToast("Couldn't save to history, but your script stays on screen.", 'error');
      }
    }
    reset();
    setActiveStep(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [output, input, history, addToast, reset, lastGeneration]);

  /* ── History actions ─────────────────────────────────────────────────── */
  const openHistoryScript = useCallback(
    async (id) => {
      try {
        const record = await history.loadScript(id);
        setOutput(record.output);
        setInput({
          url: record.input?.url || '',
          features: record.input?.features || '',
          length: record.input?.length ?? 90,
          tone: record.input?.tone || 'professional',
          videoTool: record.input?.videoTool || 'any',
        });
        setLastGeneration(record.generation || null);
        setState(STATES.RESULTS);
        setHistoryOpen(false);
        addToast('Loaded from history.', 'success');
      } catch (err) {
        addToast(err.message || 'Could not load that script.', 'error');
      }
    },
    [history, setOutput, setInput, setState, setLastGeneration, addToast]
  );

  const handleHistoryDelete = useCallback(
    (id) => {
      setConfirm({
        title: 'Delete this script?',
        message: 'It will be removed from this device permanently. This cannot be undone.',
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await history.deleteHistoryItem(id);
          setConfirm(null);
          addToast('Script deleted.', 'success');
        },
      });
    },
    [history, addToast]
  );

  const handleClearAllHistory = useCallback(() => {
    setConfirm({
      title: 'Clear all history?',
      message: `This deletes all ${history.historyIndex.length} saved scripts from this device. Cannot be undone.`,
      confirmLabel: 'Clear All',
      onConfirm: async () => {
        await history.clearHistory();
        setConfirm(null);
        addToast('History cleared.', 'success');
      },
    });
  }, [history, addToast]);

  const copyHistoryScript = useCallback(
    async (id) => {
      try {
        const record = await history.loadScript(id);
        const text = formatFullOutput(record.output);
        let ok = false;
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(text);
            ok = true;
          } catch (err) {
            ok = fallbackCopy(text);
          }
        } else {
          ok = fallbackCopy(text);
        }
        addToast(ok ? 'Full script copied from history.' : 'Copy failed — open the script and copy there.', ok ? 'success' : 'error');
      } catch (err) {
        addToast(err.message || 'Could not read that script.', 'error');
      }
    },
    [history, addToast]
  );

  const handleExport = useCallback(async () => {
    const count = await history.exportHistory();
    addToast(
      count ? `Exported ${count} script${count === 1 ? '' : 's'} as JSON.` : 'No saved scripts to export yet.',
      count ? 'success' : 'info'
    );
  }, [history, addToast]);

  const handleClearAllData = useCallback(() => {
    setConfirm({
      title: 'Delete everything?',
      message: 'This will delete all scripts, settings, and your API key. Cannot be undone.',
      confirmLabel: 'Delete Everything',
      onConfirm: async () => {
        await history.clearHistory();
        try {
          Object.keys(window.localStorage)
            .filter((key) => key.startsWith('kf_'))
            .forEach((key) => window.localStorage.removeItem(key));
        } catch (err) {
          /* storage blocked — nothing else to do */
        }
        setConfirm(null);
        setSettingsOpen(false);
        reset();
        addToast('All Keyframe data removed from this device.', 'success');
      },
    });
  }, [history, reset, addToast]);

  /* ── Field adapter: components call onChange(key, value) ────────────── */
  const handleFieldChange = useCallback(
    (key, value) => setInput({ [key]: value }),
    [setInput]
  );

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const showLanding = state === STATES.EMPTY && !editing && !output && !inWorkspace;
  const canGenerate = isValidUrl(input.url) && String(input.features || '').trim().length > 0;

  const handleGetStarted = useCallback(() => {
    if (state === STATES.RESULTS) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setInWorkspace(true);
    reset();
    setTimeout(() => {
      workRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.getElementById('kf-main-url')?.focus(), 350);
    }, 60);
  }, [state, reset]);

  /* Entering the workspace because the hero URL was submitted. */
  const enterWorkspaceFromHero = useCallback(() => {
    setInWorkspace(true);
  }, []);

  const handlePullRefresh = useCallback(async () => {
    if (state !== STATES.RESULTS || refreshing) return;
    setRefreshing(true);
    await runGeneration();
    setRefreshing(false);
  }, [state, refreshing, runGeneration]);

  return (
    <div className="kf-shell" style={{ position: 'relative', overflowX: 'hidden' }}>
      <Navbar
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onGetStarted={handleGetStarted}
        historyCount={history.historyIndex.length}
      />

      <main style={{ flex: 1, paddingBottom: 96 }}>
      {pwa.shouldShowInstall && !installBannerHidden && (
        <InstallPrompt
          isIOSManual={pwa.isIOSManual}
          onInstall={pwa.promptInstall}
          onDismiss={() => {
            pwa.dismissInstall();
            setInstallBannerHidden(true);
          }}
          onToast={addToast}
        />
      )}

      <UpdateBanner onToast={addToast} />

      {refreshing && (
        <div
          role="status"
          className="kf-anim-fade"
          style={{
            position: 'fixed',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 220,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--toast-shadow)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
          }}
        >
          <RefreshCw size={14} className="kf-anim-pull-spin" color="var(--accent-primary)" />
          Regenerating…
        </div>
      )}

      {!isOnline && (
        <div
          role="status"
          style={{
            background: 'var(--accent-warning)',
            color: '#1A1A2E',
            textAlign: 'center',
            padding: '8px 16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          📡 You're offline. Saved scripts still work — generation needs a connection.
        </div>
      )}

        {showLanding && (
          <>
            <Hero
              values={input}
              onChange={handleFieldChange}
              onGenerate={() => {
                enterWorkspaceFromHero();
                runGeneration();
              }}
            />
            <TrustBar />
            <HowItWorks />
            <BentoGrid />
            <OutputPreview />
            <FAQ />
            <Footer values={input} onChange={handleFieldChange} onGenerate={() => runGeneration()} />
          </>
        )}

        {!showLanding && (
          <div
            className="kf-container"
            ref={workRef}
            style={{
              paddingTop: 40,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              scrollMarginTop: 76,
            }}
          >
            {editing ? (
              <InputCard
                values={input}
                onChange={handleFieldChange}
                onGenerate={() => runGeneration()}
                heading="✏️ Update the brief"
                buttonLabel="Regenerate Script"
              />
            ) : state === STATES.RESULTS ? (
              <>
                <InputSummary
                  input={input}
                  onEdit={() => setEditing(true)}
                  onRedo={() => runGeneration()}
                />
                {output && (
                  <p className="kf-caption" style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: -8 }}>
                    Tip: pull down at the top on mobile to regenerate · swipe left/right to change tabs
                  </p>
                )}
              </>
            ) : (
              <InputCard
                values={input}
                onChange={handleFieldChange}
                onGenerate={() => runGeneration()}
                busy={state === STATES.LOADING}
                dimmed={state === STATES.LOADING}
              />
            )}

            {/* Screen-level heading for assistive tech and outline structure */}
            <h1 className="sr-only">
              {state === STATES.RESULTS && output
                ? `Demo script for ${output.meta?.appName || 'your app'}`
                : 'Keyframe workspace'}
            </h1>

            {state === STATES.LOADING && (
              <LoadingStepper
                activeStep={activeStep}
                onCancel={cancelGeneration}
                note={
                  regeneratingScreen
                    ? `Regenerating with ${regeneratingScreen} included…`
                    : null
                }
              />
            )}

            {state === STATES.ERROR && error && (
              <ErrorBox
                error={error}
                onRetry={() => runGeneration()}
                onEditInputs={() => {
                  reset();
                  setEditing(true);
                }}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}

            {state === STATES.RESULTS && output && (
              <div style={{ scrollMarginTop: 76 }}>
                <ResultsTabs
                  output={output}
                  onAddToScript={addScreenToScript}
                  regeneratingScreen={regeneratingScreen}
                  onToast={addToast}
                  onSwipeRefresh={handlePullRefresh}
                />

                <div
                  className="kf-results-actions"
                  style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}
                >
                  <button type="button" className="kf-btn kf-btn--primary" onClick={copyAll}>
                    <Copy size={16} /> {copiedAll ? 'Copied! ✓' : 'Copy All'}
                  </button>
                  <button type="button" className="kf-btn kf-btn--secondary" onClick={newScript}>
                    <Plus size={16} /> New Script
                  </button>
                  <button
                    type="button"
                    className="kf-btn kf-btn--ghost"
                    onClick={() => runGeneration()}
                    title="Regenerate this script"
                    aria-label="Regenerate this script"
                  >
                    <RefreshCw size={16} /> <span className="copy-label">Regenerate</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        historyIndex={history.historyIndex}
        onOpenScript={openHistoryScript}
        onDelete={handleHistoryDelete}
        onClearAll={handleClearAllHistory}
        onCopyScript={copyHistoryScript}
        onToast={addToast}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        updateSetting={updateSetting}
        onExport={handleExport}
        onClearAllData={handleClearAllData}
      />

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <BottomBar
        state={state}
        onGenerate={() => runGeneration()}
        onCancel={cancelGeneration}
        onCopyAll={copyAll}
        onNewScript={newScript}
        onRetry={() => runGeneration()}
        onEditInputs={() => reset()}
        canGenerate={canGenerate}
        copied={copiedAll}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP ROOT — providers + hooks
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const { settings, updateSetting } = useSettings();
  const history = useHistory();
  const { isOnline } = useOnlineStatus();
  const pwa = usePWAInstall();
  const appState = useAppState();

  /* First visit: seed length/tone/tool from settings defaults (Step 46). */
  useEffect(() => {
    const stored = readJSON(KF_KEYS.lastInputs, null);
    if (!stored || !stored.savedAt) {
      appState.setInput?.({
        length: settings.defaultLength,
        tone: settings.defaultTone,
        videoTool: settings.defaultVideoTool,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ToastProvider>
      <Shell
        settings={settings}
        updateSetting={updateSetting}
        history={history}
        isOnline={isOnline}
        pwa={pwa}
        appState={appState}
      />
    </ToastProvider>
  );
}
