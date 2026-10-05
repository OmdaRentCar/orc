import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

// Guided tour of the dashboard: a spotlight on one element at a time, with a short explanation.
// Elements are found by their data-tour attribute; a step whose element is not on screen
// (e.g. the sidebar on a phone) is shown in the middle instead.

export interface TourStep {
  target?: string; // value of data-tour
  title: string;
  text: string;
}

const PAD = 8;
const CARD_W = 340;

function rectOf(target?: string): DOMRect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

// Card next to the spotlight: on the right if it fits, otherwise below, otherwise above
function cardPosition(r: DOMRect | null, cardH: number): React.CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!r || vw < 640) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  const clampY = (y: number) => Math.max(16, Math.min(y, vh - cardH - 16));
  const clampX = (x: number) => Math.max(16, Math.min(x, vw - CARD_W - 16));
  if (r.right + PAD + 16 + CARD_W < vw) return { left: r.right + PAD + 16, top: clampY(r.top + r.height / 2 - cardH / 2) };
  if (r.bottom + PAD + 16 + cardH < vh) return { left: clampX(r.left + r.width / 2 - CARD_W / 2), top: r.bottom + PAD + 16 };
  return { left: clampX(r.left + r.width / 2 - CARD_W / 2), top: Math.max(16, r.top - PAD - 16 - cardH) };
}

export default function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(200);
  const step = steps[i];
  const last = i === steps.length - 1;

  const measure = useCallback(() => setRect(rectOf(step?.target)), [step]);

  // Bring the element into view, then measure it once scrolling has settled
  useLayoutEffect(() => {
    const el = step?.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    const t = setTimeout(measure, 350);
    return () => clearTimeout(t);
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (last) onClose(); else setI((n) => n + 1); }
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Dims everything except the spotlight, and blocks clicks on the page during the tour */}
      {rect ? (
        <div
          className="absolute rounded-xl transition-all duration-300 ease-out pointer-events-none ring-2 ring-brand-red/70"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={(el) => { if (el && Math.abs(el.offsetHeight - cardH) > 2) setCardH(el.offsetHeight); }}
        className="absolute bg-brand-surface border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-5 transition-all duration-300 ease-out"
        style={{ width: `min(${CARD_W}px, calc(100vw - 32px))`, ...cardPosition(rect, cardH) }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-red">Tour · {i + 1} / {steps.length}</span>
          <button onClick={onClose} className="text-xs text-brand-muted hover:text-brand-text">Skip tour</button>
        </div>
        <h2 id="tour-title" className="text-base font-bold text-brand-text mb-1.5">{step.title}</h2>
        <p className="text-sm text-brand-muted leading-relaxed">{step.text}</p>
        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1">
            {steps.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-brand-red' : 'w-1.5 bg-white/15'}`} />)}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="px-3 py-1.5 rounded-lg text-sm text-brand-muted hover:text-brand-text">Back</button>}
            <button onClick={() => (last ? onClose() : setI(i + 1))} autoFocus className="px-4 py-1.5 rounded-lg bg-brand-red text-white text-sm font-semibold hover:brightness-110">
              {last ? 'Finish' : i === 0 ? 'Start' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
