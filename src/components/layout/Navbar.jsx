import { useEffect, useState } from 'react';
import { History, Menu, Settings, X } from 'lucide-react';
import { LogoLockup } from '../shared/Logo.jsx';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
];

/**
 * Section 8.1 — sticky 64px glass navbar.
 * Desktop: logo · center links · history/settings/CTA.
 * Mobile: logo · history · settings · hamburger drawer.
 */
export default function Navbar({ onOpenHistory, onOpenSettings, onGetStarted, historyCount = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const linkStyle = {
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    fontSize: 14,
    color: 'var(--text-secondary)',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 150ms ease, background-color 150ms ease',
  };

  return (
    <>
      <header
        className="kf-navbar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          zIndex: 200,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${scrolled ? 'var(--border-subtle)' : 'transparent'}`,
          transition: 'border-color 200ms ease',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div
          className="kf-container-wide"
          style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {/* Logo */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onGetStarted?.();
            }}
            aria-label="Keyframe home"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}
          >
            <LogoLockup size={22} fontSize={20} />
          </a>

          {/* Center links — desktop only */}
          <nav
            className="kf-nav-center"
            aria-label="Sections"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} style={linkStyle} className="kf-nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              className="kf-icon-btn"
              onClick={onOpenHistory}
              aria-label={`Script history${historyCount ? ` (${historyCount})` : ''}`}
              title="Script history"
              style={{ position: 'relative' }}
            >
              <History size={19} />
              {historyCount > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 5,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    lineHeight: '16px',
                    textAlign: 'center',
                  }}
                >
                  {historyCount > 99 ? '99+' : historyCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className="kf-icon-btn"
              onClick={onOpenSettings}
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={19} />
            </button>

            <button
              type="button"
              className="kf-btn kf-btn--primary kf-cta-desktop"
              style={{ marginLeft: 10, height: 40, minHeight: 40 }}
              onClick={onGetStarted}
            >
              Get Started →
            </button>

            <button
              type="button"
              className="kf-icon-btn kf-hamburger"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        <style>{`
          .kf-nav-center { display: none; }
          .kf-cta-desktop { display: none; }
          .kf-hamburger { display: inline-flex; }
          .kf-nav-link:hover { color: var(--text-primary) !important; background: var(--bg-surface-hover); }
          @media (min-width: 1200px) {
            .kf-nav-center { display: flex !important; margin-right: auto; }
            .kf-cta-desktop { display: inline-flex !important; }
            .kf-hamburger { display: none !important; }
          }
        `}</style>
      </header>

      {/* Mobile hamburger drawer */}
      {menuOpen && (
        <div
          onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <nav
            aria-label="Menu"
            className="kf-anim-slide-right"
            style={{
              width: 280,
              maxWidth: '82vw',
              height: '100%',
              background: 'var(--bg-primary)',
              borderLeft: '1px solid var(--border-subtle)',
              padding: '20px 16px',
              paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--text-primary)' }}>
                Menu
              </span>
              <button type="button" className="kf-icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>

            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{ ...linkStyle, padding: '14px 12px', fontSize: 16, minHeight: 44, display: 'flex', alignItems: 'center' }}
              >
                {link.label}
              </a>
            ))}

            <div className="kf-divider" style={{ margin: '12px 0' }} />

            <button
              type="button"
              className="kf-btn kf-btn--secondary"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                setMenuOpen(false);
                onOpenHistory?.();
              }}
            >
              <History size={17} /> Script History {historyCount ? `(${historyCount})` : ''}
            </button>
            <button
              type="button"
              className="kf-btn kf-btn--secondary"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                setMenuOpen(false);
                onOpenSettings?.();
              }}
            >
              <Settings size={17} /> Settings
            </button>

            <button
              type="button"
              className="kf-btn kf-btn--primary kf-btn--lg"
              style={{ marginTop: 12 }}
              onClick={() => {
                setMenuOpen(false);
                onGetStarted?.();
              }}
            >
              Get Started →
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
