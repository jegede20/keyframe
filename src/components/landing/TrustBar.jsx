import { useEffect, useRef, useState } from 'react';

const ITEMS = [
  { icon: '🔒', label: 'No account needed' },
  { icon: '⚡', label: 'Free forever' },
  { icon: '📱', label: 'Any device' },
  { icon: '🛡️', label: 'Data stays local' },
];

/** Section 8.2 — 4-up trust row, with a one-time pulse on scroll-into-view. */
export default function TrustBar() {
  const ref = useRef(null);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPulsing(true);
            observer.disconnect();
            setTimeout(() => setPulsing(false), 800);
          }
        });
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-label="Why Keyframe"
      className="kf-container"
      style={{ marginTop: 8 }}
    >
      <div
        className="kf-card kf-trustbar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          overflow: 'hidden',
        }}
      >
        {ITEMS.map((item, index) => (
          <div
            key={item.label}
            className={pulsing ? 'kf-anim-pulse-once' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '18px 12px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 14,
              color: 'var(--text-secondary)',
              borderLeft: index % 2 === 0 ? 'none' : '1px solid var(--border-subtle)',
              borderTop: index > 1 ? '1px solid var(--border-subtle)' : 'none',
              animationDelay: pulsing ? `${index * 90}ms` : '0ms',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 16 }}>
              {item.icon}
            </span>
            {item.label}
          </div>
        ))}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .kf-trustbar { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .kf-trustbar > div {
            border-top: none !important;
            border-left: 1px solid var(--border-subtle);
          }
          .kf-trustbar > div:first-child { border-left: none !important; }
        }
      `}</style>
    </section>
  );
}
