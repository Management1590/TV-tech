'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync ref values for event listeners
  scaleRef.current = scale;
  positionRef.current = position;

  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSwipeDeltaX(0);
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    resetTransform();
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
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Keyboard navigation & shortcuts
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

  // Native non-passive Wheel & Touch listeners for smooth desktop wheel zoom and mobile pinch-to-zoom
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const el = containerRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.003;
      setScale((prevScale) => {
        const newScale = Math.min(Math.max(prevScale + delta, 1), 5);
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
        return newScale;
      });
    };

    const getDistance = (t1: Touch, t2: Touch) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDistRef.current = getDistance(e.touches[0], e.touches[1]);
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();

        // Double tap detection
        if (now - lastTapRef.current < 300) {
          e.preventDefault();
          if (scaleRef.current > 1) {
            resetTransform();
          } else {
            setScale(2.5);
          }
          lastTapRef.current = 0;
          return;
        }
        lastTapRef.current = now;

        touchStartPosRef.current = {
          x: touch.clientX - positionRef.current.x,
          y: touch.clientY - positionRef.current.y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        e.preventDefault();
        const currentDist = getDistance(e.touches[0], e.touches[1]);
        const factor = currentDist / touchStartDistRef.current;

        setScale((prev) => {
          const next = Math.min(Math.max(prev * (factor > 1 ? 1.03 : 0.97), 1), 5);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      } else if (e.touches.length === 1 && touchStartPosRef.current) {
        const touch = e.touches[0];
        if (scaleRef.current > 1) {
          e.preventDefault();
          setPosition({
            x: touch.clientX - touchStartPosRef.current.x,
            y: touch.clientY - touchStartPosRef.current.y,
          });
        } else {
          const dx = touch.clientX - touchStartPosRef.current.x;
          setSwipeDeltaX(dx);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      touchStartDistRef.current = null;
      if (scaleRef.current === 1) {
        setSwipeDeltaX((currentSwipe) => {
          if (currentSwipe > 50) {
            handlePrev();
          } else if (currentSwipe < -50) {
            handleNext();
          }
          return 0;
        });
      }
      touchStartPosRef.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, handlePrev, handleNext, resetTransform]);

  // Mouse drag handlers (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    if (scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      setSwipeDeltaX(e.clientX - dragStart.x);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (scale === 1 && Math.abs(swipeDeltaX) > 50) {
      if (swipeDeltaX > 50) {
        handlePrev();
      } else if (swipeDeltaX < -50) {
        handleNext();
      }
    }
    setSwipeDeltaX(0);
  };

  if (!isOpen || !currentItem) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between select-none touch-none animate-in fade-in-0 duration-200"
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-50">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="bg-primary/30 text-primary border-primary/30 text-xs font-mono">
            {currentIndex + 1} / {imageItems.length}
          </Badge>
          {title && <h3 className="text-sm font-semibold text-foreground truncate max-w-xs sm:max-w-md">{title}</h3>}
          {scale > 1 && (
            <Badge variant="outline" className="text-xs font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
              {Math.round(scale * 100)}% Zoom
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetTransform}
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

      {/* Main Interactive Stage with Gesture & Drag Container */}
      <div
        ref={containerRef}
        className="relative w-full flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={() => (scale > 1 ? resetTransform() : setScale(2.5))}
      >
        {/* Navigation Arrow Left */}
        {imageItems.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-black/60 hover:bg-primary/80 text-foreground flex items-center justify-center backdrop-blur-sm border border-border shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Container with smooth hardware-accelerated transforms */}
        <div
          className="relative max-w-full max-h-full transition-transform duration-75 ease-out flex items-center justify-center pointer-events-none"
          style={{
            transform: `translate3d(${position.x + (scale === 1 ? swipeDeltaX : 0)}px, ${position.y}px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={currentItem.secureUrl || currentItem.url}
            alt={currentItem.filename || title || 'Photo preview'}
            className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        </div>

        {/* Navigation Arrow Right */}
        {imageItems.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-black/60 hover:bg-primary/80 text-foreground flex items-center justify-center backdrop-blur-sm border border-border shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="w-full flex items-center justify-center pb-6 pt-2 z-50">
        <div className="flex items-center gap-1 sm:gap-2 px-4 py-2 rounded-2xl bg-muted/90 border border-border backdrop-blur-md shadow-2xl">
          {imageItems.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="text-foreground hover:text-foreground hover:bg-muted rounded-xl px-2.5 h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          )}

          <div className="h-4 w-px bg-muted mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 1}
            className="text-foreground hover:text-foreground hover:bg-muted rounded-xl h-8 w-8 disabled:opacity-30"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetTransform}
            className="text-foreground hover:text-foreground hover:bg-muted rounded-xl px-2.5 h-8 text-xs font-mono"
            title="Reset to 100%"
          >
            {Math.round(scale * 100)}%
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 5}
            className="text-foreground hover:text-foreground hover:bg-muted rounded-xl h-8 w-8 disabled:opacity-30"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-muted mx-1" />

          {imageItems.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              className="text-foreground hover:text-foreground hover:bg-muted rounded-xl px-2.5 h-8 gap-1 text-xs"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
