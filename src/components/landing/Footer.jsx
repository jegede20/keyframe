import { useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { isValidUrl } from '../../services/jina.js';
import { LogoLockup } from '../shared/Logo.jsx';

const FOOTER_LINKS = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
];

/** Section 8.2 — closing CTA (repeats the hero input) + footer. */
export default function Footer({ values, onChange, onGenerate, onStart }) {
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
        className="kf-footer"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
          padding: '32px 20px 28px',
        }}
      >
        <div className="kf-container kf-footer-grid">
          <div className="kf-footer-brand">
            <LogoLockup size={22} fontSize={19} />
            <p className="kf-small" style={{ color: 'var(--text-tertiary)', marginTop: 10, maxWidth: 320 }}>
              Paste a link, get a shot-by-shot demo script. Everything runs in your
              browser — no account, no server, no uploads.
            </p>
          </div>

          <nav className="kf-footer-nav" aria-label="Footer">
            {FOOTER_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="kf-footer-link">
                {link.label}
              </a>
            ))}
            <button type="button" className="kf-footer-link kf-footer-link--action" onClick={() => onStart?.()}>
              Start a script <ArrowRight size={14} aria-hidden="true" />
            </button>
          </nav>
        </div>

        <div className="kf-container kf-footer-base">
          <span>No accounts · No tracking</span>
          <span>© {new Date().getFullYear()} Keyframe</span>
        </div>

        <style>{`
          .kf-footer-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
            align-items: flex-start;
            justify-content: space-between;
          }
          .kf-footer-brand { display: flex; flex-direction: column; }
          .kf-footer-nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
          }
          .kf-footer-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: var(--font-body);
            font-size: 14px;
            color: var(--text-secondary);
            padding: 8px 0;
            min-height: 44px;
            transition: color 150ms ease;
          }
          .kf-footer-link:hover { color: var(--accent-primary); }
          .kf-footer-link--action { font-weight: 500; color: var(--text-primary); }
          .kf-footer-base {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid var(--border-subtle);
            font-family: var(--font-body);
            font-size: 12.5px;
            color: var(--text-tertiary);
          }
          @media (min-width: 768px) {
            .kf-footer-nav { flex-direction: row; gap: 22px; align-items: center; }
          }
        `}</style>
      </footer>
    </>
  );
}
