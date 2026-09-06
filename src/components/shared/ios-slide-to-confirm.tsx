'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronRight, ChevronsRight, Loader2, Lock, Trash2 } from 'lucide-react';
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

const KNOB_SIZE = 48; // 48px circle
const TRACK_PADDING = 4; // 4px padding on each side (h-14 = 56px total)

export function IosSlideToConfirm({
  onConfirm,
  isLoading = false,
  label = 'slide to delete',
  loadingLabel = 'Deleting...',
  disabled = false,
  disabledReason,
  variant = 'danger',
  className,
}: IosSlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const x = useMotionValue(0);

  // Measure container width responsively
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

  // Smooth expanding gradient fill behind knob
  const fillWidth = useTransform(x, (val) => {
    if (disabled) return 0;
    if (trackWidth <= 0) return 0;
    return Math.min(trackWidth, Math.max(0, val + KNOB_SIZE + TRACK_PADDING));
  });

  // Fade out shimmering label as knob slides across
  const textOpacity = useTransform(x, [0, Math.max(1, maxDrag * 0.4)], [1, 0]);

  // Gentle knob icon scale on nearing completion
  const knobScale = useTransform(progress, [0.75, 0.95], [1, 1.15]);

  // Handle drag release
  const handleDragEnd = useCallback(() => {
    if (disabled || isLoading || isTriggered) return;

    const currentX = x.get();
    const threshold = maxDrag * 0.82;

    if (currentX >= threshold) {
      setIsTriggered(true);
      animate(x, maxDrag, { type: 'spring', damping: 25, stiffness: 350 });

      // iOS tactile haptic feedback
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // ignore if vibration blocked
        }
      }

      onConfirm();
    } else {
      animate(x, 0, { type: 'spring', damping: 25, stiffness: 350 });
    }
  }, [disabled, isLoading, isTriggered, maxDrag, onConfirm, x]);

  // Reset when loading ends or if disabled changes
  useEffect(() => {
    if (!isLoading && isTriggered) {
      setIsTriggered(false);
      animate(x, 0, { type: 'spring', damping: 25, stiffness: 350 });
    }
  }, [isLoading, isTriggered, x]);

  useEffect(() => {
    if (disabled) {
      animate(x, 0, { type: 'spring', damping: 25, stiffness: 350 });
    }
  }, [disabled, x]);

  const isBusy = isLoading || isTriggered;

  // Variants styling
  const trackBorderBg = disabled
    ? 'border-border/40 bg-muted/30'
    : variant === 'danger'
    ? 'border-red-500/30 bg-red-950/10 dark:bg-red-950/20'
    : 'border-primary/30 bg-primary/10';

  const fillGradient =
    variant === 'danger'
      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500'
      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary';

  return (
    <div className={cn('relative w-full select-none touch-none', className)}>
      <div
        ref={trackRef}
        className={cn(
          'relative w-full h-14 rounded-full border p-1 overflow-hidden shadow-inner flex items-center transition-colors',
          trackBorderBg
        )}
      >
        {/* Expanding Color Fill Behind Knob */}
        {!disabled && (
          <motion.div
            style={{ width: fillWidth }}
            className={cn(
              'absolute inset-y-1 left-1 rounded-full pointer-events-none shadow-[0_0_16px_rgba(239,68,68,0.35)]',
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
              <span className="bg-gradient-to-r from-red-500 via-rose-300 to-red-500 dark:from-red-400 dark:via-rose-100 dark:to-red-400 bg-clip-text text-transparent animate-ios-shimmer">
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

        {/* Draggable Knob Thumb */}
        <motion.div
          drag={disabled || isBusy ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={{ left: 0, right: 0.12 }}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'relative z-20 w-12 h-12 rounded-full flex items-center justify-center shadow-lg select-none touch-none will-change-transform transform-gpu',
            disabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border/60 shadow-none'
              : 'bg-white dark:bg-slate-100 text-red-600 cursor-grab active:cursor-grabbing border border-white/80 shadow-[0_3px_12px_rgba(0,0,0,0.2),0_1px_3px_rgba(0,0,0,0.1)] active:scale-95 transition-transform'
          )}
        >
          {isBusy ? (
            <Loader2 className="w-5 h-5 animate-spin text-red-600" />
          ) : disabled ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : (
            <motion.div style={{ scale: knobScale }} className="flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-red-600 stroke-[2.75]" />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
