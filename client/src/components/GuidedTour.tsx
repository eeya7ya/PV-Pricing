// Lightweight interactive product tour ("coach marks"). Dependency-free.
//
// Highlights a sequence of elements (located by CSS selector, typically a
// data-testid) with a spotlight cutout and a tooltip card. Steps whose target
// element isn't in the DOM are skipped automatically.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

interface GuidedTourProps {
  run: boolean;
  steps: TourStep[];
  onFinish: () => void;
}

const TIP_WIDTH = 320;

export default function GuidedTour({ run, steps, onFinish }: GuidedTourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (run) setIndex(0);
  }, [run]);

  const measure = useCallback(() => {
    const step = steps[index];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [index, steps]);

  useLayoutEffect(() => {
    if (!run) return;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // Re-measure briefly to track smooth-scroll / layout settling.
    const interval = window.setInterval(measure, 250);
    const stop = window.setTimeout(() => window.clearInterval(interval), 1500);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [run, measure]);

  if (!run) return null;
  const step = steps[index];
  if (!step) return null;

  const last = index === steps.length - 1;
  const first = index === 0;

  const pad = 8;
  const spotlight = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  // Place the tooltip below the target if there's room, otherwise above; clamp
  // horizontally to the viewport. Falls back to centre when no target found.
  let tipTop: number;
  let tipLeft: number;
  if (rect) {
    const below = rect.bottom + 14;
    const wouldOverflow = below + 200 > window.innerHeight;
    tipTop = wouldOverflow ? Math.max(14, rect.top - 200) : below;
    tipLeft = Math.min(Math.max(rect.left, 14), Math.max(14, window.innerWidth - TIP_WIDTH - 14));
  } else {
    tipTop = window.innerHeight / 2 - 90;
    tipLeft = window.innerWidth / 2 - TIP_WIDTH / 2;
  }

  const next = () => (last ? onFinish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <div className="fixed inset-0 z-[100]" data-testid="guided-tour">
      {/* Click-catcher (transparent) so the app isn't interacted with mid-tour. */}
      <div className="absolute inset-0" onClick={onFinish} />

      {/* Spotlight: the huge box-shadow dims everything except the cutout. */}
      {spotlight && (
        <div
          className="absolute rounded-lg pointer-events-none transition-all duration-200"
          style={{ ...spotlight, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', outline: '2px solid rgb(251 146 60)' }}
        />
      )}
      {!spotlight && <div className="absolute inset-0 bg-black/60" />}

      {/* Tooltip card */}
      <div
        className="absolute rounded-xl border bg-popover text-popover-foreground shadow-2xl p-4"
        style={{ top: tipTop, left: tipLeft, width: TIP_WIDTH }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFinish}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs font-medium text-orange-500 mb-1">Step {index + 1} of {steps.length}</div>
        <div className="font-semibold mb-1 pr-5">{step.title}</div>
        <p className="text-sm text-muted-foreground">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <button onClick={onFinish} className="text-xs text-muted-foreground hover:underline">Skip tour</button>
          <div className="flex gap-2">
            {!first && <Button size="sm" variant="outline" onClick={back}>Back</Button>}
            <Button size="sm" onClick={next} data-testid="button-tour-next">{last ? 'Done' : 'Next'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
