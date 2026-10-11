import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Scissors, Video } from 'lucide-react';
import ScriptTab from './ScriptTab.jsx';
import CutListTab from './CutListTab.jsx';
import VideoPromptTab from './VideoPromptTab.jsx';

const TABS = [
  { id: 'script', label: 'Script', short: 'Script', icon: Clapperboard },
  { id: 'cut', label: 'Cut List', short: 'Cut List', icon: Scissors },
  { id: 'prompt', label: 'Video Prompt', short: 'Prompt', icon: Video },
];

/**
 * Section 8.5 + 9 — tab bar with count badge, crossfade switching,
 * and swipe-left/right gesture support on mobile.
 */
export default function ResultsTabs({
  output,
  onAddToScript,
  regeneratingScreen,
  onToast,
  activeTab,
  onTabChange,
  onSwipeRefresh,
}) {
  const [internalTab, setInternalTab] = useState('script');
  const tab = activeTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;
  const touch = useRef({ x: 0, y: 0, active: false });

  // Swipe tabs when the results view is on screen.
  useEffect(() => {
    const onTouchStart = (event) => {
      if (window.scrollY > 4) return; // don't fight scrolling
      const t = event.touches[0];
      touch.current = { x: t.clientX, y: t.clientY, active: true };
    };
    const onTouchEnd = (event) => {
      if (!touch.current.active) return;
      touch.current.active = false;
      const t = event.changedTouches[0];
      const dx = t.clientX - touch.current.x;
      const dy = t.clientY - touch.current.y;

      // Horizontal tab swipe
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const index = TABS.findIndex((x) => x.id === tab);
        const next = dx < 0 ? Math.min(TABS.length - 1, index + 1) : Math.max(0, index - 1);
        if (next !== index) setTab(TABS[next].id);
        return;
      }
      // Pull-to-refresh: pull down from the very top
      if (dy > 80 && Math.abs(dx) < 40 && window.scrollY <= 0) {
        onSwipeRefresh?.();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [tab, setTab, onSwipeRefresh]);

  const cutCount = output?.cutList?.length || 0;

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Script output sections"
        className="kf-tabs"
        style={{
          display: 'flex',
          gap: 2,
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 20,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TABS.map(({ id, label, short, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              aria-controls={`kf-tabpanel-${id}`}
              id={`kf-tab-${id}`}
              type="button"
              onClick={() => setTab(id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
                padding: '0 16px',
                flex: '1 0 auto',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: 14,
                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
                marginBottom: -1,
                transition: 'color 150ms ease, border-color 150ms ease, background-color 150ms ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--bg-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="kf-tab-label-full">
                {label}
                {id === 'cut' && cutCount > 0 ? ` (${cutCount})` : ''}
              </span>
              <span className="kf-tab-label-short">
                {short}
                {id === 'cut' && cutCount > 0 ? ` (${cutCount})` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div
        role="tabpanel"
        id={`kf-tabpanel-${tab}`}
        aria-labelledby={`kf-tab-${tab}`}
        key={tab}
        className="kf-anim-tab"
      >
        {tab === 'script' && <ScriptTab output={output} onToast={onToast} />}
        {tab === 'cut' && (
          <CutListTab
            output={output}
            onAddToScript={onAddToScript}
            regeneratingScreen={regeneratingScreen}
            onToast={onToast}
          />
        )}
        {tab === 'prompt' && <VideoPromptTab output={output} onToast={onToast} />}
      </div>
    </div>
  );
}
