import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Lightbulb, SkipForward } from 'lucide-react';
import { useTour, type TourStep } from '../../contexts/TourContext';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT_EST = 200;

function getTargetRect(selector: string): Rect | null {
  if (selector === 'center') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY,
    left: r.left + window.scrollX,
    width: r.width,
    height: r.height,
  };
}

function computeTooltipPos(
  rect: Rect | null,
  placement: TourStep['placement'],
  vpW: number,
  vpH: number
): { top: number; left: number; arrowDir: 'top' | 'bottom' | 'left' | 'right' | null } {
  if (!rect || placement === 'center') {
    return {
      top: window.scrollY + (vpH - TOOLTIP_HEIGHT_EST) / 2,
      left: (vpW - TOOLTIP_WIDTH) / 2,
      arrowDir: null,
    };
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let top = 0;
  let left = 0;
  let arrowDir: 'top' | 'bottom' | 'left' | 'right' = 'top';

  const scrollY = window.scrollY;
  const effectivePlacement = placement ?? 'bottom';

  switch (effectivePlacement) {
    case 'bottom':
      top = rect.top + rect.height + PADDING + 12;
      left = Math.max(8, Math.min(centerX - TOOLTIP_WIDTH / 2, vpW - TOOLTIP_WIDTH - 8));
      arrowDir = 'top';
      break;
    case 'top':
      top = rect.top - TOOLTIP_HEIGHT_EST - PADDING - 12;
      left = Math.max(8, Math.min(centerX - TOOLTIP_WIDTH / 2, vpW - TOOLTIP_WIDTH - 8));
      arrowDir = 'bottom';
      if (top < scrollY + 8) {
        top = rect.top + rect.height + PADDING + 12;
        arrowDir = 'top';
      }
      break;
    case 'left':
      top = centerY - TOOLTIP_HEIGHT_EST / 2;
      left = rect.left - TOOLTIP_WIDTH - PADDING - 12;
      arrowDir = 'right';
      if (left < 8) {
        left = rect.left + rect.width + PADDING + 12;
        arrowDir = 'left';
      }
      break;
    case 'right':
      top = centerY - TOOLTIP_HEIGHT_EST / 2;
      left = rect.left + rect.width + PADDING + 12;
      arrowDir = 'left';
      if (left + TOOLTIP_WIDTH > vpW - 8) {
        left = rect.left - TOOLTIP_WIDTH - PADDING - 12;
        arrowDir = 'right';
      }
      break;
  }

  return { top: Math.max(scrollY + 8, top), left, arrowDir };
}

function SpotlightMask({ rect, padding }: { rect: Rect | null; padding: number }) {
  const vw = window.innerWidth;
  const docH = Math.max(document.body.scrollHeight, window.innerHeight);

  if (!rect) {
    return (
      <div className="fixed inset-0 bg-black/50 pointer-events-none z-[9998]" />
    );
  }

  const sp = padding;
  const rx = rect.left - sp;
  const ry = rect.top - sp;
  const rw = rect.width + sp * 2;
  const rh = rect.height + sp * 2;

  const clipPath = `polygon(
    0 0, ${vw}px 0, ${vw}px ${docH}px, 0 ${docH}px,
    0 ${ry}px,
    ${rx}px ${ry}px,
    ${rx}px ${ry + rh}px,
    ${rx + rw}px ${ry + rh}px,
    ${rx + rw}px ${ry}px,
    0 ${ry}px
  )`;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[9998]"
      style={{
        background: 'rgba(0,0,0,0.55)',
        clipPath,
        top: 0,
        left: 0,
        width: vw,
        height: docH,
      }}
    />
  );
}

export default function TourOverlay() {
  const { activeTour, currentStepIndex, nextStep, prevStep, skipTour, stopTour } = useTour();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, arrowDir: null as null | 'top' | 'bottom' | 'left' | 'right' });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = activeTour?.steps[currentStepIndex] ?? null;

  const measureAndPosition = useCallback(() => {
    if (!step) return;
    const rect = getTargetRect(step.target);
    setTargetRect(rect);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pos = computeTooltipPos(rect, step.placement, vw, vh);
    setTooltipPos(pos);

    if (rect) {
      const el = document.querySelector(step.target);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    setTimeout(() => setVisible(true), 50);
  }, [step?.id]);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(measureAndPosition, 200);
    return () => clearTimeout(t);
  }, [measureAndPosition]);

  useEffect(() => {
    window.addEventListener('resize', measureAndPosition);
    window.addEventListener('scroll', measureAndPosition, true);
    return () => {
      window.removeEventListener('resize', measureAndPosition);
      window.removeEventListener('scroll', measureAndPosition, true);
    };
  }, [measureAndPosition]);

  if (!activeTour || !step) return null;

  const totalSteps = activeTour.steps.length;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  const arrowClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 border-b-white',
    bottom: 'top-full left-1/2 -translate-x-1/2 border-t-white',
    left: 'right-full top-1/2 -translate-y-1/2 border-r-white',
    right: 'left-full top-1/2 -translate-y-1/2 border-l-white',
  };

  const content = (
    <>
      <SpotlightMask rect={targetRect} padding={step.spotlightPadding ?? PADDING} />

      {targetRect && (
        <div
          className="absolute z-[9999] pointer-events-none"
          style={{
            top: targetRect.top - (step.spotlightPadding ?? PADDING),
            left: targetRect.left - (step.spotlightPadding ?? PADDING),
            width: targetRect.width + (step.spotlightPadding ?? PADDING) * 2,
            height: targetRect.height + (step.spotlightPadding ?? PADDING) * 2,
            borderRadius: 12,
            boxShadow: '0 0 0 4px rgba(59,130,246,0.5), 0 0 0 2px rgba(255,255,255,0.8)',
            transition: 'all 0.3s ease',
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="absolute z-[10000] transition-all duration-300"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_WIDTH,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)',
        }}
      >
        <div className="bg-navy-800/60 rounded-2xl shadow-2xl shadow-black/20 border border-white/[0.06] overflow-hidden relative">
          {tooltipPos.arrowDir && (
            <div
              className={`absolute w-0 h-0 ${arrowClasses[tooltipPos.arrowDir]}`}
              style={{
                border: '8px solid transparent',
                ...(tooltipPos.arrowDir === 'top' && { borderBottomColor: 'white', bottom: '100%', left: '50%', transform: 'translateX(-50%)' }),
                ...(tooltipPos.arrowDir === 'bottom' && { borderTopColor: 'white', top: '100%', left: '50%', transform: 'translateX(-50%)' }),
                ...(tooltipPos.arrowDir === 'left' && { borderRightColor: 'white', right: '100%', top: '50%', transform: 'translateY(-50%)' }),
                ...(tooltipPos.arrowDir === 'right' && { borderLeftColor: 'white', left: '100%', top: '50%', transform: 'translateY(-50%)' }),
              }}
            />
          )}

          <div className="h-1 bg-white/[0.06]">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-white leading-tight">
                    {step.title}
                  </h3>
                  <button
                    onClick={stopTour}
                    className="text-slate-300 hover:text-slate-500 transition shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                  Krok {currentStepIndex + 1} z {totalSteps}
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              {step.content}
            </p>

            {step.action && (
              <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-200 rounded-xl text-xs text-amber-400 font-medium">
                {step.action}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={skipTour}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-400 transition"
              >
                <SkipForward className="w-3 h-3" />
                Přeskočit
              </button>

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={prevStep}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 border border-white/10 rounded-lg hover:bg-white/[0.04] transition"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Zpět
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition "
                >
                  {isLast ? 'Dokončit' : 'Dále'}
                  {!isLast && <ArrowRight className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-4">
              {activeTour.steps.map((_, i) => (
                <div
                  key={i}
                  className={`transition-all duration-300 rounded-full ${
                    i === currentStepIndex
                      ? 'w-4 h-1.5 bg-blue-500'
                      : i < currentStepIndex
                      ? 'w-1.5 h-1.5 bg-blue-200'
                      : 'w-1.5 h-1.5 bg-white/[0.08]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
