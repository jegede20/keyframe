import { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  MessageSquareQuote,
  Timer,
  Scissors,
  Video,
  Smartphone,
} from 'lucide-react';

const CARDS = [
  {
    id: 'script',
    size: 'large',
    icon: Clapperboard,
    title: 'Shot-by-Shot Script',
    body: 'Every shot numbered, labelled OPENING → FEATURE 1… → CLOSING, with the screen to show and the exact action to take. It reads like a director’s board, not a blob of prose.',
    accent: true,
  },
  { id: 'narration', icon: MessageSquareQuote, title: 'Narrator Lines', body: 'Spoken-word lines written to fit the clock at 130 words per minute.' },
  { id: 'timing', size: 'wide', icon: Timer, title: 'Smart Timing', body: 'Shot durations sum exactly to your target length. 30s, 60s, 90s or 120s — no gaps, no overruns.' },
  { id: 'cut', icon: Scissors, title: 'Cut List', body: 'The screens we left out and why — with one click to add any of them back in.' },
  {
    id: 'prompt',
    size: 'tall',
    icon: Video,
    title: 'Video AI Prompt',
    body: 'A 300–600 word, self-contained prompt tuned for Runway, Pika, HeyGen, Synthesia and CapCut. Paste it and go.',
    accent: true,
  },
  { id: 'pwa', icon: Smartphone, title: 'PWA — Install Anywhere', body: 'Installable from the browser. Works on your phone, keeps history on-device, no app store.' },
];

/** Section 8.2 — bento layout: 2 large + 4 medium, scale-in on scroll. */
export default function BentoGrid() {
  const ref = useRef(null);
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible((prev) => ({ ...prev, [entry.target.dataset.card]: true }));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    el.querySelectorAll('[data-card]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={ref} className="kf-container" style={{ paddingTop: 48, paddingBottom: 48, scrollMarginTop: 76 }}>
      <h2 className="kf-section-headline" style={{ textAlign: 'center', marginBottom: 12 }}>
        Everything a demo needs — in one pass
      </h2>
      <p className="kf-small" style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 40px' }}>
        Keyframe writes the parts of a demo people usually skip: timing, what to skip, and the prompt for your video tool.
      </p>

      <div className="kf-bento">
        {CARDS.map((card, index) => {
          const Icon = card.icon;
          const isVisible = visible[card.id];
          return (
            <article
              key={card.id}
              data-card={card.id}
              className={`kf-card kf-hover-lift kf-reveal-scale ${isVisible ? 'is-visible' : ''} kf-bento-card ${card.size ? `kf-bento-${card.size}` : ''}`}
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transitionDelay: `${(index % 3) * 90}ms`,
                borderColor: card.accent ? 'var(--border-subtle)' : undefined,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--accent-primary-glow)',
                  color: 'var(--accent-primary)',
                }}
              >
                <Icon size={20} />
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 20,
                  color: 'var(--text-primary)',
                }}
              >
                {card.title}
              </h3>
              <p className="kf-small" style={{ color: 'var(--text-secondary)' }}>
                {card.body}
              </p>
            </article>
          );
        })}
      </div>

      <style>{`
        .kf-bento {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .kf-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .kf-bento-large { grid-column: span 2; }
        }
        @media (min-width: 1200px) {
          .kf-bento {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            grid-auto-flow: dense;
          }
          .kf-bento-large { grid-column: span 2; grid-row: span 1; }
          .kf-bento-tall { grid-row: span 2; }
          .kf-bento-wide { grid-column: span 2; }
        }
        .kf-bento-card:hover { border-color: rgba(108, 92, 231, 0.3); }
      `}</style>
    </section>
  );
}
