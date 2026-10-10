import { useState } from 'react';
import { ArrowRight, Link2, Lock, Sparkles } from 'lucide-react';
import { isValidUrl } from '../../services/jina.js';

/**
 * Section 8.2 — hero with the app's primary entry point.
 * The URL input here IS the app entry (desktop: 60% width beside the button).
 */
export default function Hero({ values, onChange, onGenerate }) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [pulse, setPulse] = useState(false);

  const url = values.url || '';
  const urlValid = isValidUrl(url);
  const showError = touched && url.trim().length > 0 && !urlValid;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (urlValid) onGenerate();
  };

  return (
    <section
      className="kf-hero"
      style={{ position: 'relative', paddingTop: 72, paddingBottom: 56, textAlign: 'center' }}
    >
      <div className="kf-hero-backdrop" aria-hidden="true" />

      <div className="kf-container" style={{ position: 'relative', zIndex: 1, maxWidth: 820 }}>
        <span className="kf-pill kf-pill--glass kf-anim-hero kf-anim-hero-1" style={{ backdropFilter: 'blur(8px)' }}>
          ⚡ Free · No sign-up · Works on any device
        </span>

        <h1
          className="kf-hero-headline kf-anim-hero kf-anim-hero-2"
          style={{ margin: '22px auto 18px', maxWidth: 720 }}
        >
          Turn any app into a{' '}
          <span style={{ color: 'var(--accent-primary)' }}>demo script</span> you can shoot today
        </h1>

        <p
          className="kf-anim-hero kf-anim-hero-3"
          style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            maxWidth: 540,
            margin: '0 auto 34px',
          }}
        >
          Paste a link, list the features that matter, and get a shot-by-shot 1–2 minute script
          with timing, what to click, what to say — plus a cut list and a ready-to-paste video AI
          prompt.
        </p>

        <form
          onSubmit={submit}
          className="kf-anim-hero kf-anim-hero-4 kf-hero-form"
          style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 720, margin: '0 auto' }}
        >
          <div style={{ position: 'relative', flex: '1 1 60%', textAlign: 'left' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 15,
                top: 26,
                color: focused ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                display: 'inline-flex',
                transition: 'color 150ms ease',
              }}
            >
              <Link2 size={17} />
            </span>
            <input
              id="kf-hero-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck="false"
              aria-label="App URL"
              className={`kf-input kf-input--with-icon ${showError ? 'kf-input--error' : ''} ${pulse ? 'kf-anim-paste' : ''}`}
              style={{ height: 52 }}
              placeholder="https://your-app.com"
              value={url}
              onChange={(e) => onChange('url', e.target.value)}
              onPaste={() => {
                setPulse(true);
                setTimeout(() => setPulse(false), 560);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                setTouched(true);
              }}
            />
            {showError && (
              <p className="kf-caption" style={{ color: 'var(--accent-danger)', marginTop: 6, paddingLeft: 4 }}>
                Enter a full web address, e.g. https://yourapp.com
              </p>
            )}
          </div>

          <button
            type="submit"
            className={`kf-btn kf-btn--primary kf-btn--lg ${urlValid ? 'kf-anim-glow' : ''}`}
            disabled={!urlValid}
            style={{ flexShrink: 0 }}
          >
            <Sparkles size={17} aria-hidden="true" />
            Generate Script
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>

        <p
          className="kf-anim-hero kf-anim-hero-4"
          style={{
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Lock size={13} aria-hidden="true" /> No account needed — everything stays on your device.
        </p>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .kf-hero { padding-top: 44px !important; padding-bottom: 40px !important; }
          .kf-hero-form {
            flex-direction: column !important;
          }
          .kf-hero-form > div, .kf-hero-form > button {
            width: 100% !important;
            flex: none !important;
          }
          .kf-hero-form > button { margin-top: 2px; }
        }
      `}</style>
    </section>
  );
}
