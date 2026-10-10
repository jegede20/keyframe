import { useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { isValidUrl } from '../../services/jina.js';

/** Section 8.2 — closing CTA (repeats the hero input) + footer. */
export default function Footer({ values, onChange, onGenerate }) {
  const [pulse, setPulse] = useState(false);
  const url = values.url || '';
  const urlValid = isValidUrl(url);

  return (
    <>
      <section className="kf-container" style={{ paddingTop: 40, paddingBottom: 64 }}>
        <div
          className="kf-card"
          style={{
            maxWidth: 820,
            margin: '0 auto',
            padding: '40px 28px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -120,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 480,
              height: 260,
              background: 'radial-gradient(ellipse at center, var(--accent-primary) 0%, transparent 65%)',
              opacity: 0.1,
              pointerEvents: 'none',
            }}
          />
          <h2 className="kf-section-headline" style={{ marginBottom: 10, position: 'relative' }}>
            Your next demo script is one link away
          </h2>
          <p className="kf-small" style={{ color: 'var(--text-secondary)', marginBottom: 24, position: 'relative' }}>
            Free, no sign-up, and it stays on your device.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (urlValid) onGenerate();
            }}
            className="kf-footer-form"
            style={{ display: 'flex', gap: 12, maxWidth: 620, margin: '0 auto', position: 'relative' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 15,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  display: 'inline-flex',
                }}
              >
                <Link2 size={17} />
              </span>
              <input
                type="url"
                inputMode="url"
                aria-label="App URL"
                className={`kf-input kf-input--with-icon ${pulse ? 'kf-anim-paste' : ''}`}
                style={{ height: 52 }}
                placeholder="https://your-app.com"
                value={url}
                onChange={(e) => onChange('url', e.target.value)}
                onPaste={() => {
                  setPulse(true);
                  setTimeout(() => setPulse(false), 560);
                }}
              />
            </div>
            <button type="submit" className="kf-btn kf-btn--primary kf-btn--lg" disabled={!urlValid} style={{ flexShrink: 0 }}>
              Generate <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>

      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
          padding: '24px 20px',
          paddingBottom: 'calc(24px + 76px)', // clears the mobile bottom bar
        }}
      >
        <div
          className="kf-container kf-footer-inner"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--text-tertiary)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>▶</span>
            <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Keyframe</strong>
            <span>· Built with ☕ and free tiers.</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a
              className="kf-link"
              href="https://github.com/"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: 'var(--text-tertiary)' }}
            >
              GitHub
            </a>
            <span>Privacy (there is none — we store nothing)</span>
          </span>
        </div>

        <style>{`
          @media (min-width: 768px) {
            footer { padding-bottom: 24px !important; }
          }
        `}</style>
      </footer>
    </>
  );
}
