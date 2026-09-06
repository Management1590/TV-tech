'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronRight, ChevronsRight, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IosSlideToConfirmProps {
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  variant?: 'danger' | 'warning' | 'primary';
  className?: string;
}

const KNOB_SIZE = 46; // 46px circle
const TRACK_PADDING = 4; // 4px padding on each side (h-[54px] total)

export function IosSlideToConfirm({
  onConfirm,
  isLoading = false,
  label = 'slide to confirm',
  loadingLabel = 'Processing...',
  disabled = false,
  disabledReason,
  variant = 'danger',
  className,
}: IosSlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Gesture tracking refs
  const isPointerDownRef = useRef(false);
  const startClientXRef = useRef(0);
  const startKnobXRef = useRef(0);

  const x = useMotionValue(0);

  // Responsive track width measurement
  useEffect(() => {
    const updateWidth = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.clientWidth);
      }
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    if (trackRef.current) {
      observer.observe(trackRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const maxDrag = Math.max(0, trackWidth - KNOB_SIZE - TRACK_PADDING * 2);

  // Dynamic progress: 0 to 1
  const progress = useTransform(x, [0, Math.max(1, maxDrag)], [0, 1]);

  // Expanding color fill behind knob from left track edge
  const fillWidth = useTransform(x, (val) => {
    if (disabled || trackWidth <= 0) return 0;
    return Math.min(trackWidth, Math.max(0, val + KNOB_SIZE + TRACK_PADDING));
  });

  // Fade out shimmering label as knob slides across
  const textOpacity = useTransform(x, [0, Math.max(1, maxDrag * 0.45)], [1, 0]);

  // Threshold icon swap / scale feedback
  const iconScale = useTransform(progress, [0.65, 0.95], [1, 1.18]);

  const isBusy = isLoading || isTriggered;

  // Pointer Down: captures touch/pointer on track or knob for 1:1 tracking
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isBusy || maxDrag <= 0) return;

    // Prevent parent sheets (e.g. Y-drag) from intercepting horizontal slide
    e.stopPropagation();

    const track = trackRef.current;
    if (!track) return;

    isPointerDownRef.current = true;
    setIsDragging(true);

    const rect = track.getBoundingClientRect();
    const touchXInTrack = e.clientX - rect.left - TRACK_PADDING;
    const currentKnobX = x.get();

    // If tapped near or on the knob, drag relative to current position
    // If tapped further along track, immediately jump knob toward pointer
    if (Math.abs(touchXInTrack - (currentKnobX + KNOB_SIZE / 2)) < KNOB_SIZE * 0.9) {
      startClientXRef.current = e.clientX;
      startKnobXRef.current = currentKnobX;
    } else {
      const targetX = Math.min(maxDrag, Math.max(0, touchXInTrack - KNOB_SIZE / 2));
      startClientXRef.current = e.clientX;
      startKnobXRef.current = targetX;
      x.set(targetX);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  // Pointer Move: direct 1:1 hardware-accelerated tracking with zero latency
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || disabled || isBusy || maxDrag <= 0) return;
    e.stopPropagation();

    const deltaX = e.clientX - startClientXRef.current;
    const newX = Math.min(maxDrag, Math.max(0, startKnobXRef.current + deltaX));
    x.set(newX);
  };

  // Pointer Up / Cancel: evaluate threshold and spring to target
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const currentX = x.get();
    // 70% distance is the natural iOS confirmation threshold
    const threshold = maxDrag * 0.70;

    if (currentX >= threshold && !isTriggered) {
      setIsTriggered(true);
      // Spring smoothly to end
      animate(x, maxDrag, { type: 'spring', damping: 24, stiffness: 360, mass: 0.5 });

      // iOS tactile haptic vibration
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([25, 35]);
        } catch {}
      }

      onConfirm();
    } else {
      // Spring smoothly back to start
      animate(x, 0, { type: 'spring', damping: 24, stiffness: 380, mass: 0.5 });
    }
  };

  // Reset when loading ends
  useEffect(() => {
    if (!isLoading && isTriggered) {
      setIsTriggered(false);
      animate(x, 0, { type: 'spring', damping: 24, stiffness: 380, mass: 0.5 });
    }
  }, [isLoading, isTriggered, x]);

  // Reset if disabled changes
  useEffect(() => {
    if (disabled) {
      animate(x, 0, { type: 'spring', damping: 24, stiffness: 380, mass: 0.5 });
    }
  }, [disabled, x]);

  // Variants styling
  const trackBorderBg = disabled
    ? 'border-border/40 bg-muted/30'
    : variant === 'danger'
    ? 'border-red-500/30 bg-red-950/15 dark:bg-red-950/30'
    : variant === 'warning'
    ? 'border-amber-500/30 bg-amber-950/15 dark:bg-amber-950/30'
    : 'border-primary/30 bg-primary/10';

  const fillGradient =
    variant === 'danger'
      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
      : variant === 'warning'
      ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary shadow-[0_0_20px_rgba(59,130,246,0.4)]';

  const knobTextColor =
    variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : 'text-primary';

  return (
    <div className={cn('relative w-full select-none touch-none', className)}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          'relative w-full h-[54px] rounded-full border p-1 overflow-hidden shadow-inner flex items-center transition-colors cursor-pointer touch-none select-none',
          trackBorderBg
        )}
      >
        {/* Expanding Color Fill Behind Knob */}
        {!disabled && (
          <motion.div
            style={{ width: fillWidth }}
            className={cn(
              'absolute inset-y-1 left-1 rounded-full pointer-events-none will-change-[width]',
              fillGradient
            )}
          />
        )}

        {/* Shimmering Center Label */}
        {!disabled && !isBusy && (
          <motion.div
            style={{ opacity: textOpacity }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none px-12"
          >
            <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider select-none text-center">
              <span className="bg-gradient-to-r from-red-500 via-rose-200 to-red-500 dark:from-red-400 dark:via-rose-100 dark:to-red-400 bg-clip-text text-transparent animate-ios-shimmer">
                {label}
              </span>
              <ChevronsRight className="w-4 h-4 text-red-500/70 animate-pulse" />
            </div>
          </motion.div>
        )}

        {/* Busy / Loading State Label */}
        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-white drop-shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{loadingLabel}</span>
            </div>
          </div>
        )}

        {/* Disabled State Label */}
        {disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide text-muted-foreground select-none">
              <Lock className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
              <span className="truncate">{disabledReason || label}</span>
            </div>
          </div>
        )}

        {/* Ultra-Smooth Draggable Knob Thumb */}
        <motion.div
          style={{
            x,
            scale: isDragging ? 1.05 : 1,
          }}
          transition={{
            scale: { duration: 0.12, ease: 'easeOut' },
          }}
          className={cn(
            'relative z-20 w-[46px] h-[46px] rounded-full flex items-center justify-center select-none touch-none will-change-transform transform-gpu',
            disabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border/60 shadow-none'
              : 'bg-white dark:bg-slate-100 cursor-grab active:cursor-grabbing border border-white/90 shadow-[0_3px_12px_rgba(0,0,0,0.22),0_1px_3px_rgba(0,0,0,0.12)]'
          )}
        >
          {isBusy ? (
            <Loader2 className={cn('w-5 h-5 animate-spin', knobTextColor)} />
          ) : disabled ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : (
            <motion.div style={{ scale: iconScale }} className="flex items-center justify-center pointer-events-none">
              <ChevronRight className={cn('w-5 h-5 stroke-[3]', knobTextColor)} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
