import { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const ITEMS = [
  {
    q: 'Is Keyframe really free?',
    a: 'Yes. There is no account, no paywall and no trial. It runs on free API tiers and installs on your device like an app. Nothing is metered against you — the only ceiling is the shared free tier of the AI provider, which refills every minute.',
  },
  {
    q: 'Where is my data stored?',
    a: 'On your device, and nowhere else. Your inputs and settings live in localStorage; full scripts live in IndexedDB. There is no database and no server behind Keyframe. The only two outbound requests are reading your URL through r.jina.ai and sending the scraped text to Groq for the script. No analytics. No tracking.',
  },
  {
    q: 'What video apps work with the generated prompt?',
    a: 'Runway, Pika, HeyGen, Synthesia and CapCut — pick your target in Advanced Options and the prompt is written in that tool’s house style (camera-first language for Runway, [PAUSE]/[EMPHASIS] markers for HeyGen, [CUT]/[TRANSITION] beats for CapCut). Choosing “Any” keeps it tool-agnostic.',
  },
  {
    q: 'What AI model powers Keyframe?',
    a: 'Groq’s openai/gpt-oss-120b writes the script, with an automatic fallback to openai/gpt-oss-20b if the primary model is rate-limited. Most scripts come back in well under a minute.',
  },
  {
    q: 'Can I install it on my phone?',
    a: 'Yes — it’s a Progressive Web App. On Android Chrome tap the Install prompt; on iPhone open Safari, tap Share, then “Add to Home Screen”. Installed, it opens full-screen, works offline for your saved scripts, and supports the New Script and History shortcuts from the app icon.',
  },
];

/** Section 8.2 — 5-item accordion with animated height. */
export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);
  const refs = useRef([]);

  return (
    <section id="faq" className="kf-container" style={{ paddingTop: 48, paddingBottom: 56, scrollMarginTop: 76 }}>
      <h2 className="kf-section-headline" style={{ textAlign: 'center', marginBottom: 32 }}>
        Questions, answered
      </h2>

      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ITEMS.map((item, index) => {
          const open = openIndex === index;
          const content = refs.current[index];
          const height = content ? content.scrollHeight : 0;

          return (
            <div
              key={item.q}
              className="kf-card"
              style={{ overflow: 'hidden', borderColor: open ? 'var(--border-focus)' : undefined, transition: 'border-color 200ms ease' }}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : index)}
                aria-expanded={open}
                aria-controls={`kf-faq-${index}`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  padding: '16px 18px',
                  minHeight: 44,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 17,
                    color: 'var(--text-primary)',
                  }}
                >
                  {item.q}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'var(--accent-primary-glow)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {open ? <Minus size={15} /> : <Plus size={15} />}
                </span>
              </button>

              <div
                id={`kf-faq-${index}`}
                className="kf-anim-accordion"
                style={{ maxHeight: open ? height : 0, opacity: open ? 1 : 0 }}
              >
                <div ref={(el) => { refs.current[index] = el; }}>
                  <p className="kf-small" style={{ color: 'var(--text-secondary)', padding: '0 18px 18px' }}>
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
