'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MediaItem } from './item-product-showcase';

interface ImageGestureLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  mediaList: MediaItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  title?: string;
}

export function ImageGestureLightbox({
  isOpen,
  onClose,
  mediaList,
  currentIndex,
  onIndexChange,
  title,
}: ImageGestureLightboxProps) {
  const imageItems = mediaList.filter((m) => m.mediaType === 'IMAGE');
  const currentItem = imageItems[currentIndex] || imageItems[0];

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Transform state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);
  const [dismissDeltaY, setDismissDeltaY] = useState(0);

  // Desktop mouse dragging state
  const [isDraggingMouse, setIsDraggingMouse] = useState(false);
  const [mouseDragStart, setMouseDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Gesture tracking refs for synchronous, butter-smooth 60fps touch handling
  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isGesturingRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pinch gesture tracking
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(1);
  const initialPinchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Single touch drag tracking
  const singleTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const singleTouchPosStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  scaleRef.current = scale;
  positionRef.current = position;

  const resetTransform = useCallback((animate = true) => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSwipeDeltaX(0);
    setDismissDeltaY(0);
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    if (animate) {
      setIsGesturing(false);
      isGesturingRef.current = false;
    }
  }, []);

  useEffect(() => {
    resetTransform(false);
  }, [currentIndex, isOpen, resetTransform]);

  const handlePrev = useCallback(() => {
    if (imageItems.length <= 1) return;
    const nextIdx = (currentIndex - 1 + imageItems.length) % imageItems.length;
    onIndexChange(nextIdx);
  }, [currentIndex, imageItems.length, onIndexChange]);

  const handleNext = useCallback(() => {
    if (imageItems.length <= 1) return;
    const nextIdx = (currentIndex + 1) % imageItems.length;
    onIndexChange(nextIdx);
  }, [currentIndex, imageItems.length, onIndexChange]);

  const zoomIn = () => {
    setIsGesturing(false);
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const zoomOut = () => {
    setIsGesturing(false);
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Keyboard navigation for desktop
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        resetTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose, resetTransform]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Clamp position within reasonable pan bounds based on current scale
  const clampPosition = useCallback((pos: { x: number; y: number }, currentScale: number) => {
    if (currentScale <= 1) return { x: 0, y: 0 };
    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const maxX = (vw * (currentScale - 1)) / 1.8;
    const maxY = (vh * (currentScale - 1)) / 1.8;

    return {
      x: Math.max(-maxX, Math.min(maxX, pos.x)),
      y: Math.max(-maxY, Math.min(maxY, pos.y)),
    };
  }, []);

  // Native touch & gesture listeners (Pinch-to-zoom, Double-tap, Momentum pan, Pull-to-dismiss)
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const el = containerRef.current;

    const getDistance = (t1: Touch, t2: Touch) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setIsGesturing(false);
      const delta = e.deltaY * -0.003;
      setScale((prevScale) => {
        const newScale = Math.min(Math.max(prevScale + delta, 1), 5);
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return newScale;
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Two-finger pinch gesture start
        e.preventDefault();
        isGesturingRef.current = true;
        setIsGesturing(true);

        initialPinchDistRef.current = getDistance(e.touches[0], e.touches[1]);
        initialPinchScaleRef.current = scaleRef.current;
        initialPinchCenterRef.current = getCenter(e.touches[0], e.touches[1]);
        initialPositionRef.current = { ...positionRef.current };
        singleTouchStartRef.current = null;
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();

        // Double tap check (< 300ms and close distance)
        const timeSinceLastTap = now - lastTapTimeRef.current;
        const distFromLastTap = Math.hypot(
          touch.clientX - lastTapPosRef.current.x,
          touch.clientY - lastTapPosRef.current.y
        );

        if (timeSinceLastTap < 300 && distFromLastTap < 35) {
          e.preventDefault();
          setIsGesturing(false);
          isGesturingRef.current = false;

          if (scaleRef.current > 1) {
            // Reset back to 1x smoothly
            setScale(1);
            setPosition({ x: 0, y: 0 });
            scaleRef.current = 1;
            positionRef.current = { x: 0, y: 0 };
          } else {
            // Zoom to 2.5x centered toward tap coordinate
            const targetScale = 2.5;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const offsetX = (vw / 2 - touch.clientX) * 1.2;
            const offsetY = (vh / 2 - touch.clientY) * 1.2;

            const clamped = clampPosition({ x: offsetX, y: offsetY }, targetScale);
            setScale(targetScale);
            setPosition(clamped);
            scaleRef.current = targetScale;
            positionRef.current = clamped;
          }

          lastTapTimeRef.current = 0;
          return;
        }

        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: touch.clientX, y: touch.clientY };

        // Start single finger drag
        singleTouchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: now,
        };
        singleTouchPosStartRef.current = { ...positionRef.current };
        isGesturingRef.current = true;
        setIsGesturing(true);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
        // Two-finger pinch active
        e.preventDefault();
        const currentDist = getDistance(e.touches[0], e.touches[1]);
        const scaleRatio = currentDist / initialPinchDistRef.current;
        const nextScale = Math.min(Math.max(initialPinchScaleRef.current * scaleRatio, 0.9), 5);

        // Adjust position dynamically
        const currentCenter = getCenter(e.touches[0], e.touches[1]);
        const centerDx = currentCenter.x - initialPinchCenterRef.current.x;
        const centerDy = currentCenter.y - initialPinchCenterRef.current.y;

        const nextPos = {
          x: initialPositionRef.current.x + centerDx,
          y: initialPositionRef.current.y + centerDy,
        };

        scaleRef.current = nextScale;
        positionRef.current = nextPos;
        setScale(nextScale);
        setPosition(nextPos);
      } else if (e.touches.length === 1 && singleTouchStartRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - singleTouchStartRef.current.x;
        const dy = touch.clientY - singleTouchStartRef.current.y;

        if (scaleRef.current > 1) {
          // Pan inside zoomed image with smooth direct tracking
          e.preventDefault();
          const nextPos = {
            x: singleTouchPosStartRef.current.x + dx,
            y: singleTouchPosStartRef.current.y + dy,
          };
          positionRef.current = nextPos;
          setPosition(nextPos);
        } else {
          // At 1x scale: Vertical swipe for dismiss, Horizontal swipe for next/prev
          if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
            e.preventDefault();
            setDismissDeltaY(dy);
          } else if (Math.abs(dx) > Math.abs(dy)) {
            setSwipeDeltaX(dx);
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      initialPinchDistRef.current = null;
      singleTouchStartRef.current = null;
      isGesturingRef.current = false;
      setIsGesturing(false);

      // Snap pinch scale back to bounds smoothly if released outside [1, 5]
      if (scaleRef.current < 1.05) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        scaleRef.current = 1;
        positionRef.current = { x: 0, y: 0 };
      } else {
        const clamped = clampPosition(positionRef.current, scaleRef.current);
        setPosition(clamped);
        positionRef.current = clamped;
      }

      // Handle swipe down to dismiss (mobile native gallery feel)
      setDismissDeltaY((currentY) => {
        if (currentY > 90) {
          onClose();
        }
        return 0;
      });

      // Handle horizontal swipe between images (desktop/mobile fallback)
      setSwipeDeltaX((currentX) => {
        if (scaleRef.current === 1) {
          if (currentX > 60) {
            handlePrev();
          } else if (currentX < -60) {
            handleNext();
          }
        }
        return 0;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isOpen, handlePrev, handleNext, onClose, clampPosition]);

  // Mouse Drag handlers for Computer / Desktop view
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDraggingMouse(true);
    setMouseDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMouse) return;
    if (scale > 1) {
      const nextPos = clampPosition(
        {
          x: e.clientX - mouseDragStart.x,
          y: e.clientY - mouseDragStart.y,
        },
        scale
      );
      setPosition(nextPos);
    } else {
      setSwipeDeltaX(e.clientX - mouseDragStart.x);
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingMouse) return;
    setIsDraggingMouse(false);

    if (scale === 1 && Math.abs(swipeDeltaX) > 50) {
      if (swipeDeltaX > 50) {
        handlePrev();
      } else if (swipeDeltaX < -50) {
        handleNext();
      }
    }
    setSwipeDeltaX(0);
  };

  if (!isOpen || !currentItem || !mounted) return null;

  // Fade out background on swipe-to-dismiss pull
  const dismissOpacity = Math.max(0.2, 1 - dismissDeltaY / 300);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen min-h-[100dvh] bg-black sm:bg-black/95 sm:backdrop-blur-md flex flex-col items-center justify-between select-none touch-none animate-in fade-in-0 duration-200"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${dismissOpacity})`,
      }}
      onMouseUp={handleMouseUp}
    >
      {/* ============================================================ */}
      {/* MOBILE-ONLY MINIMAL CLOSE BUTTON (Pure solid black backdrop) */}
      {/* ============================================================ */}
      <div className="sm:hidden fixed top-4 right-4 z-[110]">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 active:bg-black text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg active:scale-90 transition-transform"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ============================================================ */}
      {/* COMPUTER / DESKTOP HEADER BAR (Preserved 100% untouched)     */}
      {/* ============================================================ */}
      <div className="hidden sm:flex w-full items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-[110]">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="bg-primary/30 text-primary border-primary/30 text-xs font-mono">
            {currentIndex + 1} / {imageItems.length}
          </Badge>
          {title && (
            <h3 className="text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">
              {title}
            </h3>
          )}
          {scale > 1 && (
            <Badge
              variant="outline"
              className="text-xs font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
            >
              {Math.round(scale * 100)}% Zoom
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => resetTransform(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full h-9 w-9"
            title="Reset Zoom (0)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full h-9 w-9"
            title="Close Lightbox (Esc)"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN INTERACTIVE STAGE (Native Gallery Gestures)             */}
      {/* ============================================================ */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        {/* Computer / Desktop Navigation Arrow Left */}
        {imageItems.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-black/60 hover:bg-primary/80 text-foreground items-center justify-center backdrop-blur-sm border border-border shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Container with Hardware-Accelerated 3D Transform */}
        <div
          className={`relative max-w-full max-h-full flex items-center justify-center ${
            isGesturing || isDraggingMouse ? 'transition-none' : 'transition-transform duration-200 ease-out'
          }`}
          style={{
            transform: `translate3d(${position.x + (scale === 1 ? swipeDeltaX : 0)}px, ${
              position.y + dismissDeltaY
            }px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        >
          <img
            ref={imgRef}
            src={currentItem.secureUrl || currentItem.url}
            alt={currentItem.filename || title || 'Photo preview'}
            className="max-w-[100vw] max-h-[100vh] sm:max-w-[90vw] sm:max-h-[75vh] object-contain sm:rounded-lg shadow-2xl pointer-events-none select-none"
            draggable={false}
          />
        </div>

        {/* Computer / Desktop Navigation Arrow Right */}
        {imageItems.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-black/60 hover:bg-primary/80 text-foreground items-center justify-center backdrop-blur-sm border border-border shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* COMPUTER / DESKTOP FLOATING BOTTOM CONTROL BAR               */}
      {/* ============================================================ */}
      <div className="hidden sm:flex w-full items-center justify-center pb-6 pt-2 z-50">
        <div className="flex items-center gap-1 sm:gap-2 px-4 py-2 rounded-2xl bg-neutral-900/90 border border-white/10 backdrop-blur-md shadow-2xl">
          {imageItems.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="text-foreground hover:text-foreground hover:bg-white/10 rounded-xl px-2.5 h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          )}

          <div className="h-4 w-px bg-white/20 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 1}
            className="text-foreground hover:text-foreground hover:bg-white/10 rounded-xl h-8 w-8 disabled:opacity-30"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetTransform(true)}
            className="text-foreground hover:text-foreground hover:bg-white/10 rounded-xl px-2.5 h-8 text-xs font-mono"
            title="Reset to 100%"
          >
            {Math.round(scale * 100)}%
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 5}
            className="text-foreground hover:text-foreground hover:bg-white/10 rounded-xl h-8 w-8 disabled:opacity-30"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-white/20 mx-1" />

          {imageItems.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              className="text-foreground hover:text-foreground hover:bg-white/10 rounded-xl px-2.5 h-8 gap-1 text-xs"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

