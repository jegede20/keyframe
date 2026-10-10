import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    number: '01',
    title: 'Paste your link',
    body: 'Drop in any public app URL — a landing page, pricing page, or product page. Keyframe reads it instantly.',
  },
  {
    number: '02',
    title: 'Generate',
    body: 'Pick a length and tone. Keyframe decides which screens matter, in what order, and how long each should hold.',
  },
  {
    number: '03',
    title: 'Create',
    body: 'Shoot straight from the script, or paste the generated prompt into Runway, Pika, HeyGen, Synthesia, or CapCut.',
  },
];

/** Section 8.2 — three steps, staggered reveal, dotted connector on desktop. */
export default function HowItWorks() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={ref} className="kf-container" style={{ paddingTop: 72, paddingBottom: 48, scrollMarginTop: 76 }}>
      <h2 className="kf-section-headline" style={{ textAlign: 'center', marginBottom: 12 }}>
        From link to shot list in three steps
      </h2>
      <p className="kf-small" style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 44px' }}>
        No timeline scrubbing, no “what do I show next?” — the structure is written for you.
      </p>

      <ol
        className="kf-steps"
        style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32, position: 'relative' }}
      >
        {STEPS.map((step, index) => (
          <li
            key={step.number}
            className={`kf-reveal ${visible ? 'is-visible' : ''}`}
            style={{
              textAlign: 'center',
              transitionDelay: `${index * 150}ms`,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <p
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 48,
                lineHeight: 1,
                color: 'var(--accent-primary)',
                opacity: 0.2,
                marginBottom: 8,
              }}
            >
              {step.number}
            </p>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 20,
                color: 'var(--text-primary)',
                marginBottom: 10,
              }}
            >
              {step.title}
            </h3>
            <p className="kf-small" style={{ color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto' }}>
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <style>{`
        @media (min-width: 768px) {
          .kf-steps { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 40px !important; }
          .kf-steps::before {
            content: '';
            position: absolute;
            top: 30px;
            left: 16%;
            right: 16%;
            border-top: 2px dotted var(--border-focus);
            opacity: .6;
          }
        }
      `}</style>
    </section>
  );
}
