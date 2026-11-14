import React, { useEffect, useRef, useState } from 'react';
import { computeJoystickVector } from '../game/rules';

export interface TouchJoystickControlsProps {
  playerSlot?: 1 | 2;
  playerLabel?: string;
  accentColor?: 'emerald' | 'sky';
  layoutAlign?: 'left' | 'right';
  onMoveVector: (nx: number, nz: number) => void;
  onMoveEnd: () => void;
  onJump: () => void;
  className?: string;
}

const JOYSTICK_DEFAULT_RADIUS = 30;
const JOYSTICK_MOBILE_DEADZONE = 0.24;

/**
 * Multi-touch independent Virtual Analog Joystick + Jump button.
 * Tracks its own pointerId so Player 1 and Player 2 can steer and jump
 * simultaneously on touchscreens or mouse without blocking each other.
 */
export const TouchJoystickControls: React.FC<TouchJoystickControlsProps> = ({
  playerSlot,
  playerLabel,
  accentColor = 'emerald',
  layoutAlign = 'left',
  onMoveVector,
  onMoveEnd,
  onJump,
  className = '',
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const vectorRef = useRef<{ nx: number; nz: number }>({ nx: 0, nz: 0 });
  const jumpStampRef = useRef<number>(0);

  const onMoveVectorRef = useRef(onMoveVector);
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveVectorRef.current = onMoveVector;
  onMoveEndRef.current = onMoveEnd;

  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [jumpActive, setJumpActive] = useState(false);

  const lastImmediateEmitRef = useRef<number>(0);

  // Continuous 50ms movement ticker (20Hz) while joystick is actively held
  useEffect(() => {
    if (!dragging) return;
    const id = window.setInterval(() => {
      const { nx, nz } = vectorRef.current;
      if (nx !== 0 || nz !== 0) {
        onMoveVectorRef.current(nx, nz);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [dragging]);

  const updateFromClientXY = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const padMaxRadius = Math.max(20, Math.min(JOYSTICK_DEFAULT_RADIUS, rect.width * 0.34));
    const res = computeJoystickVector(
      clientX - cx,
      clientY - cy,
      padMaxRadius,
      JOYSTICK_MOBILE_DEADZONE
    );
    setKnob({ x: res.knobX, y: res.knobY });

    // Smooth non-linear sensitivity curve so tiny thumb nudges walk gently
    // instead of launching the character at full speed across the arena.
    if (res.magnitude > 0) {
      const curveFactor = Math.pow(res.magnitude, 0.85);
      const nx = res.nx * curveFactor;
      const nz = res.nz * curveFactor;
      vectorRef.current = { nx, nz };
      const now = performance.now();
      if (now - lastImmediateEmitRef.current >= 24) {
        lastImmediateEmitRef.current = now;
        onMoveVectorRef.current(nx, nz);
      }
    } else {
      vectorRef.current = { nx: 0, nz: 0 };
    }
  };

  const releaseJoystick = () => {
    activePointerIdRef.current = null;
    vectorRef.current = { nx: 0, nz: 0 };
    setKnob({ x: 0, y: 0 });
    setDragging(false);
    onMoveEndRef.current();
  };

  // Window-level pointerId-filtered fallback listeners so secondary touches on IFP/Chromebook/HP
  // keep tracking smoothly even if a finger slides outside the pad or pointer capture is skipped.
  useEffect(() => {
    if (!dragging) return;
    const onWinMove = (ev: PointerEvent) => {
      if (activePointerIdRef.current !== ev.pointerId) return;
      updateFromClientXY(ev.clientX, ev.clientY);
    };
    const onWinUp = (ev: PointerEvent) => {
      if (activePointerIdRef.current !== ev.pointerId) return;
      releaseJoystick();
    };
    window.addEventListener('pointermove', onWinMove, { passive: true });
    window.addEventListener('pointerup', onWinUp, { passive: true });
    window.addEventListener('pointercancel', onWinUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
    };
  }, [dragging]);

  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (activePointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or secondary multi-touch pointer events may rely on window fallback
    }
    updateFromClientXY(e.clientX, e.clientY);
    setDragging(true);
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromClientXY(e.clientX, e.clientY);
  };

  const handlePadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if already released
    }
    releaseJoystick();
  };

  const triggerJump = () => {
    const now = performance.now();
    if (now - jumpStampRef.current < 120) return;
    jumpStampRef.current = now;
    setJumpActive(true);
    onJump();
    window.setTimeout(() => setJumpActive(false), 260);
  };

  const slotSuffix = playerSlot ? `p${playerSlot}` : '1p';
  const isSky = accentColor === 'sky';
  const ringBorder = isSky ? 'border-sky-400/75' : 'border-emerald-400/75';
  const knobColors = isSky
    ? 'bg-gradient-to-br from-sky-400 to-sky-600 border-sky-200 shadow-sky-500/40'
    : 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-200 shadow-emerald-500/40';
  const jumpColors = isSky
    ? 'bg-gradient-to-b from-sky-500 to-sky-700 border-sky-200 hover:from-sky-400'
    : 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-emerald-200 hover:from-emerald-400';

  const joystickElement = (
    <div className="flex flex-col items-center gap-0.5 pointer-events-auto">
      <div
        ref={padRef}
        role="application"
        aria-label={
          playerSlot
            ? `Joystik Virtual Pemain ${playerSlot}`
            : 'Joystik Virtual Gerak Pemain'
        }
        data-testid={`joystick-pad-${slotSuffix}`}
        onPointerDown={handlePadPointerDown}
        onPointerMove={handlePadPointerMove}
        onPointerUp={handlePadPointerUp}
        onPointerCancel={handlePadPointerUp}
        onLostPointerCapture={(e) => {
          if (activePointerIdRef.current === e.pointerId) {
            releaseJoystick();
          }
        }}
        style={{ touchAction: 'none' }}
        className={`relative w-16 h-16 md:w-22 md:h-22 lg:w-24 lg:h-24 rounded-full bg-slate-950/88 border-2 ${ringBorder} shadow-2xl flex items-center justify-center select-none cursor-grab active:cursor-grabbing`}
      >
        {/* Subtle cardinal direction guides */}
        <span className="absolute top-1 md:top-1.5 text-[7px] md:text-[9px] font-black text-slate-400 pointer-events-none">
          ▲
        </span>
        <span className="absolute bottom-1 md:bottom-1.5 text-[7px] md:text-[9px] font-black text-slate-400 pointer-events-none">
          ▼
        </span>
        <span className="absolute left-1 md:left-1.5 text-[7px] md:text-[9px] font-black text-slate-400 pointer-events-none">
          ◀
        </span>
        <span className="absolute right-1 md:right-1.5 text-[7px] md:text-[9px] font-black text-slate-400 pointer-events-none">
          ▶
        </span>

        {/* Inner socket guide */}
        <div className="w-8 h-8 md:w-11 md:h-11 rounded-full border border-slate-700/80 bg-slate-900/75 pointer-events-none" />

        {/* Analog thumb knob */}
        <div
          data-testid={`joystick-knob-${slotSuffix}`}
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          className={`absolute w-7 h-7 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-full border-2 shadow-lg pointer-events-none flex items-center justify-center transition-transform ${
            dragging ? 'duration-0 scale-105' : 'duration-150'
          } ${knobColors}`}
        >
          <span className="text-[7px] md:text-[9px] font-black text-slate-950 tracking-tight">
            {playerLabel || (playerSlot ? `P${playerSlot}` : 'MOVE')}
          </span>
        </div>
      </div>
    </div>
  );

  const jumpButtonElement = (
    <button
      type="button"
      data-testid={`btn-jump-${slotSuffix}`}
      data-no-mt-click="true"
      aria-label={playerSlot ? `Tombol Lompat Pemain ${playerSlot}` : 'Tombol Lompat'}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerJump();
      }}
      onClick={(e) => {
        e.stopPropagation();
        triggerJump();
      }}
      style={{ touchAction: 'none' }}
      className={`pointer-events-auto w-11 h-11 md:w-13 md:h-13 lg:w-14 lg:h-14 rounded-full border-2 text-white font-extrabold shadow-xl flex flex-col items-center justify-center cursor-pointer select-none transition-transform ${
        jumpActive ? 'scale-90 ring-4 ring-amber-300/70' : 'active:scale-90'
      } ${jumpColors}`}
    >
      <span className="text-xs md:text-sm leading-none">⬆️</span>
      <span className="text-[7px] md:text-[9px] font-black tracking-wide leading-none mt-0.5">
        LOMPAT
      </span>
    </button>
  );

  return (
    <div
      data-testid={`touch-controls-${slotSuffix}`}
      className={`pointer-events-none flex items-end gap-1.5 md:gap-2 select-none ${className}`}
    >
      {layoutAlign === 'right' ? (
        <>
          {jumpButtonElement}
          {joystickElement}
        </>
      ) : (
        <>
          {joystickElement}
          {jumpButtonElement}
        </>
      )}
    </div>
  );
};
