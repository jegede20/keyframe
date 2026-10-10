import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link2, Lock, Sparkles } from 'lucide-react';
import AdvancedOptions from './AdvancedOptions.jsx';
import { isValidUrl } from '../../services/jina.js';

const FEATURES_MAX = 500;

/**
 * Section 8.3 — the main input surface.
 * URL field (real-time validation + paste pulse), auto-grow features textarea
 * with counter, AdvancedOptions, Generate button, privacy line.
 */
export default function InputCard({
  values,
  onChange,
  onGenerate,
  busy = false,
  dimmed = false,
  compact = false,
  autoFocus = false,
  heading = '🎬 What are we demoing?',
  idPrefix = 'kf-main',
  buttonLabel = 'Generate Script',
}) {
  const [urlTouched, setUrlTouched] = useState(false);
  const [pastePulse, setPastePulse] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const textareaRef = useRef(null);
  const urlRef = useRef(null);

  const urlValue = values.url || '';
  const featuresValue = values.features || '';
  const urlValid = isValidUrl(urlValue);
  const showUrlError = urlTouched && urlValue.trim().length > 0 && !urlValid;

  // Auto-grow: min 100px, max 200px then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(200, Math.max(100, el.scrollHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [featuresValue]);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => urlRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const handlePaste = () => {
    setPastePulse(true);
    setTimeout(() => setPastePulse(false), 560);
  };

  const counterColor =
    featuresValue.length >= FEATURES_MAX
      ? 'var(--accent-danger)'
      : featuresValue.length >= 450
        ? 'var(--accent-warning)'
        : 'var(--text-tertiary)';

  const canGenerate = urlValid && featuresValue.trim().length > 0 && !busy;

  const submit = (event) => {
    event?.preventDefault();
    setUrlTouched(true);
    if (canGenerate) onGenerate();
    else if (!urlValid) urlRef.current?.focus();
  };

  return (
    <section
      aria-label="Demo script inputs"
      className={`kf-card ${dimmed || compact ? '' : 'kf-anim-expand'}`}
      style={{
        width: '100%',
        maxWidth: 820,
        margin: '0 auto',
        padding: compact ? 20 : undefined,
        opacity: dimmed ? 0.6 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transition: 'opacity 300ms ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '32px 32px 28px' }} className="kf-inputcard-pad">
        {heading && (
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 22,
              color: 'var(--text-primary)',
              marginBottom: 20,
            }}
          >
            {heading}
          </h2>
        )}

        <form onSubmit={submit} noValidate>
          {/* URL */}
          <div style={{ marginBottom: 18 }}>
            <label htmlFor={`${idPrefix}-url`} className="kf-label" style={{ display: 'block', marginBottom: 8 }}>
              App URL
            </label>
            <div style={{ position: 'relative' }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 15,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: urlFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  display: 'inline-flex',
                  transition: 'color 150ms ease',
                }}
              >
                <Link2 size={17} />
              </span>
              <input
                ref={urlRef}
                id={`${idPrefix}-url`}
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck="false"
                className={`kf-input kf-input--with-icon ${urlValue ? 'kf-anim-paste' : ''} ${showUrlError ? 'kf-input--error' : ''} ${pastePulse ? 'kf-anim-paste' : ''}`}
                style={{ height: 52 }}
                placeholder="https://your-app.com"
                value={urlValue}
                disabled={busy}
                onChange={(e) => onChange('url', e.target.value)}
                onPaste={handlePaste}
                onFocus={() => setUrlFocused(true)}
                onBlur={() => {
                  setUrlFocused(false);
                  setUrlTouched(true);
                }}
                aria-invalid={showUrlError}
                aria-describedby={showUrlError ? `${idPrefix}-url-error` : undefined}
              />
            </div>
            {showUrlError && (
              <p
                id={`${idPrefix}-url-error`}
                className="kf-caption"
                style={{ color: 'var(--accent-danger)', marginTop: 6, paddingLeft: 4 }}
              >
                That doesn't look like a valid web address — include the full address, e.g. https://yourapp.com
              </p>
            )}
          </div>

          {/* Features */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor={`${idPrefix}-features`} className="kf-label" style={{ display: 'block', marginBottom: 8 }}>
              Key Features to Highlight
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                id={`${idPrefix}-features`}
                className="kf-textarea"
                style={{ minHeight: 100, maxHeight: 200, paddingBottom: 26 }}
                placeholder={'e.g. One-click export, real-time collab, AI suggestions...'}
                value={featuresValue}
                disabled={busy}
                maxLength={FEATURES_MAX}
                onChange={(e) => onChange('features', e.target.value.slice(0, FEATURES_MAX))}
              />
              <span
                className="kf-mono"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 8,
                  fontSize: 12,
                  color: counterColor,
                  transition: 'color 150ms ease',
                }}
              >
                {featuresValue.length}/{FEATURES_MAX}
              </span>
            </div>
          </div>

          <AdvancedOptions values={values} onChange={onChange} disabled={busy} />

          {/* Generate */}
          <button
            type="submit"
            className={`kf-btn kf-btn--primary kf-btn--lg kf-generate ${canGenerate ? 'kf-anim-glow' : ''}`}
            style={{ width: '100%', marginTop: 18 }}
            disabled={!canGenerate}
            aria-disabled={!canGenerate}
          >
            <Sparkles size={17} aria-hidden="true" />
            {buttonLabel}
          </button>

          <p
            className="kf-caption"
            style={{
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontWeight: 400,
            }}
          >
            <Lock size={13} aria-hidden="true" /> No account needed — everything stays on your device.
          </p>
        </form>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .kf-inputcard-pad { padding: 20px !important; }
          .kf-generate { height: 52px; }
        }
      `}</style>
    </section>
  );
}

export { FEATURES_MAX };
