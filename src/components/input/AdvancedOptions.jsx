import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LENGTH_OPTIONS, TONE_OPTIONS, VIDEO_TOOL_OPTIONS } from '../../services/promptBuilder.js';

/**
 * Section 8.3 — collapsed by default, expands with a 200ms height animation.
 */
export default function AdvancedOptions({ values, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const innerRef = useRef(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return undefined;
    const update = () => setHeight(el.scrollHeight);
    update();
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="kf-advanced"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          minHeight: 44,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 14,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} aria-hidden="true" />
          <span>Advanced Options</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 200ms ease',
              color: 'var(--accent-text)',
            }}
          />
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} aria-hidden="true" />
      </button>

      <div
        id="kf-advanced"
        className="kf-anim-accordion"
        style={{
          maxHeight: open ? height : 0,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <div ref={innerRef}>
          <div
            className="kf-advanced-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 14,
              paddingTop: 16,
              paddingBottom: 4,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="kf-label">Script Length</span>
              <select
                className="kf-select"
                value={values.length}
                disabled={disabled}
                onChange={(e) => onChange('length', Number(e.target.value))}
              >
                {LENGTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="kf-label">Tone</span>
              <select
                className="kf-select"
                value={values.tone}
                disabled={disabled}
                onChange={(e) => onChange('tone', e.target.value)}
              >
                {TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="kf-label">Video Tool Target</span>
              <select
                className="kf-select"
                value={values.videoTool}
                disabled={disabled}
                onChange={(e) => onChange('videoTool', e.target.value)}
              >
                {VIDEO_TOOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .kf-advanced-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
