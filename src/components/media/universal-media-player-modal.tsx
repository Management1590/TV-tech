'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Move,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface UniversalMediaItem {
  id: string;
  mediaType: string | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PDF';
  url: string;
  secureUrl?: string | null;
  publicId?: string | null;
  filename?: string | null;
  title?: string | null;
  sizeBytes?: number | null;
  createdAt?: Date | string;
}

interface UniversalMediaPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: UniversalMediaItem[];
  initialIndex?: number;
  onDelete?: (item: UniversalMediaItem) => void;
  isAdmin?: boolean;
}

export function UniversalMediaPlayerModal({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
  onDelete,
  isAdmin = false,
}: UniversalMediaPlayerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Video Player state & Rotation
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoRotation, setVideoRotation] = useState(0);

  // Fullscreen state
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Bottom filmstrip ref for auto-scrolling active thumbnail into view
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Mounted check for createPortal (SSR safety)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Gesture tracking refs for mobile images
  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isGesturingRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(1);
  const initialPinchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const singleTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const singleTouchPosStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  scaleRef.current = zoom;
  positionRef.current = pan;

  // Listen to fullscreen changes across browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
      resetTransform();
    }
  }, [isOpen, initialIndex, items.length]);

  const currentItem = items[currentIndex];

  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsPlaying(false);
    setVideoProgress(0);
    setVideoRotation(0);
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    isGesturingRef.current = false;
  }, []);

  // Handle active item change
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      const boundedIndex = (newIndex + items.length) % items.length;
      setCurrentIndex(boundedIndex);
      resetTransform();
    },
    [items.length, resetTransform]
  );

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    handleIndexChange(currentIndex + 1);
  }, [currentIndex, items.length, handleIndexChange]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    handleIndexChange(currentIndex - 1);
  }, [currentIndex, items.length, handleIndexChange]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === '0') {
        resetTransform();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key === ' ' && currentItem?.mediaType === 'VIDEO') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, currentItem, resetTransform]);

  // Scroll active filmstrip item into center view smoothly
  useEffect(() => {
    if (activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Zoom controls (Images)
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Drag & Pan handlers (Images)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (currentItem?.mediaType === 'VIDEO') return;
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Double-click to toggle 1x / 2x zoom or fullscreen on video
  const handleDoubleClick = () => {
    if (currentItem?.mediaType === 'VIDEO') {
      toggleFullscreen();
    } else {
      if (zoom > 1) {
        resetTransform();
      } else {
        setZoom(2);
      }
    }
  };

  // Video Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setCurrentTime(current);
    setDuration(dur);
    setVideoProgress((current / dur) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekPercent = parseFloat(e.target.value);
    const newTime = (seekPercent / 100) * duration;
    videoRef.current.currentTime = newTime;
    setVideoProgress(seekPercent);
  };

  const toggleFullscreen = () => {
    const targetElement = videoContainerRef.current || modalContainerRef.current;
    if (!targetElement) return;

    if (!document.fullscreenElement) {
      targetElement.requestFullscreen().catch(() => {
        // Fallback for iOS / mobile video elements
        if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
        }
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleRotateVideo = () => {
    setVideoRotation((prev) => (prev + 90) % 360);
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Touch gesture listeners on mobile for images (Pinch to Zoom, Double Tap, Swipe to Navigate/Dismiss)
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !imageContainerRef.current || currentItem?.mediaType === 'VIDEO') return;
    const el = imageContainerRef.current;

    const getDistance = (t1: Touch, t2: Touch) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        isGesturingRef.current = true;
        initialPinchDistRef.current = getDistance(e.touches[0], e.touches[1]);
        initialPinchScaleRef.current = scaleRef.current;
        initialPinchCenterRef.current = getCenter(e.touches[0], e.touches[1]);
        initialPositionRef.current = { ...positionRef.current };
        singleTouchStartRef.current = null;
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;
        const distFromLastTap = Math.hypot(
          touch.clientX - lastTapPosRef.current.x,
          touch.clientY - lastTapPosRef.current.y
        );

        if (timeSinceLastTap < 300 && distFromLastTap < 35) {
          e.preventDefault();
          if (scaleRef.current > 1) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            scaleRef.current = 1;
            positionRef.current = { x: 0, y: 0 };
          } else {
            const targetScale = 2.5;
            setZoom(targetScale);
            scaleRef.current = targetScale;
          }
          lastTapTimeRef.current = 0;
          return;
        }

        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: touch.clientX, y: touch.clientY };

        singleTouchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: now,
        };
        singleTouchPosStartRef.current = { ...positionRef.current };
        isGesturingRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
        e.preventDefault();
        const currentDist = getDistance(e.touches[0], e.touches[1]);
        const scaleRatio = currentDist / initialPinchDistRef.current;
        const nextScale = Math.min(Math.max(initialPinchScaleRef.current * scaleRatio, 0.9), 5);
        scaleRef.current = nextScale;
        setZoom(nextScale);
      } else if (e.touches.length === 1 && singleTouchStartRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - singleTouchStartRef.current.x;
        const dy = touch.clientY - singleTouchStartRef.current.y;

        if (scaleRef.current > 1) {
          e.preventDefault();
          const nextPos = {
            x: singleTouchPosStartRef.current.x + dx,
            y: singleTouchPosStartRef.current.y + dy,
          };
          positionRef.current = nextPos;
          setPan(nextPos);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0 && singleTouchStartRef.current) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - singleTouchStartRef.current.x;
        const dy = touch.clientY - singleTouchStartRef.current.y;

        if (scaleRef.current <= 1.05) {
          // Swipe down to dismiss
          if (dy > 120 && Math.abs(dx) < 80) {
            onClose();
          } else if (dx < -60 && Math.abs(dy) < 60) {
            handleNext();
          } else if (dx > 60 && Math.abs(dy) < 60) {
            handlePrev();
          }
        }
      }

      if (e.touches.length === 0) {
        initialPinchDistRef.current = null;
        singleTouchStartRef.current = null;
        isGesturingRef.current = false;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, currentItem?.mediaType, onClose, handleNext, handlePrev]);

  if (!isOpen || !currentItem || !mounted) return null;

  const currentMediaUrl = currentItem.secureUrl || currentItem.url;
  const isVideo = currentItem.mediaType === 'VIDEO';

  const modalContent = (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-[99999] bg-black flex flex-col h-screen w-screen min-h-[100dvh] select-none animate-in fade-in duration-200 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* ========================================================================= */}
      {/* 1. MOBILE MINIMAL FLOATING CLOSE BUTTON (Clutterless Top Right)           */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={onClose}
        className="sm:hidden absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-xl active:scale-90 transition-transform cursor-pointer"
        title="Close Viewer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ========================================================================= */}
      {/* 2. DESKTOP TOP FLOATING CONTROL BAR (Frosted Glass Capsule)                */}
      {/* ========================================================================= */}
      <div className="relative z-30 shrink-0 hidden sm:flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 text-white border-b border-white/10 bg-black/40 backdrop-blur-md">
        {/* Left: Media Title & Counter Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
            {isVideo ? <Film className="w-4 h-4 text-primary/80" /> : <ImageIcon className="w-4 h-4 text-emerald-400" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-md text-white tracking-tight">
              {currentItem.filename || (isVideo ? 'Video Clip' : 'Image Photo')}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <span>
                {currentIndex + 1} of {items.length}
              </span>
              {currentItem.sizeBytes && (
                <span>• {(currentItem.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Glass Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom controls (Only for Images) */}
          {!isVideo && (
            <div className="flex items-center bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl p-1 shadow-lg">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-bold px-1.5 min-w-[40px] text-center text-white/90">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all ml-0.5 cursor-pointer"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={resetTransform}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all ml-0.5 cursor-pointer text-[10px] font-bold"
                title="Reset View (0)"
              >
                1:1
              </button>
            </div>
          )}

          {/* Download Button */}
          <a
            href={currentMediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={currentItem.filename || 'download'}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-xl rounded-2xl text-white transition-all shadow-lg cursor-pointer"
            title="Download Original File"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-xl rounded-2xl text-white transition-all shadow-lg cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title={isFullscreen ? 'Exit Full Screen (F)' : 'Switch to Full Screen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-red-600/80 hover:bg-red-600 border border-red-500/50 backdrop-blur-xl rounded-2xl text-white transition-all shadow-lg cursor-pointer active:scale-95"
            title="Close Viewer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN STAGE: EXPANSIVE FULL-SIZE VIDEO PLAYER & ZOOM CANVAS             */}
      {/* ========================================================================= */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden p-0 sm:px-6 sm:py-3"
        onWheel={handleWheel}
      >
        {/* Left Navigation Arrow (Desktop only) */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="hidden sm:flex absolute left-2 sm:left-6 z-30 p-3 sm:p-4 rounded-3xl bg-white/10 hover:bg-white/25 border border-white/20 text-white backdrop-blur-xl shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer group items-center justify-center"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Media Canvas */}
        <div
          ref={imageContainerRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {isVideo ? (
            /* Expansive Full-Stage Video Player Container */
            <div
              ref={videoContainerRef}
              className="relative w-full sm:max-w-5xl h-full flex flex-col items-center justify-center sm:rounded-3xl overflow-hidden shadow-2xl bg-black sm:border sm:border-white/15 group/video"
            >
              <video
                ref={videoRef}
                src={currentMediaUrl}
                playsInline
                onClick={togglePlay}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                style={{
                  transform: videoRotation ? `rotate(${videoRotation}deg)` : undefined,
                  maxWidth: videoRotation % 180 !== 0 ? '90vh' : '100%',
                  maxHeight: videoRotation % 180 !== 0 ? '90vw' : '100%',
                  transition: 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
                }}
                className="w-full h-full object-contain cursor-pointer pb-16 sm:pb-14"
              />

              {/* Big Center Play Overlay (when paused) */}
              {!isPlaying && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-xl flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer z-10"
                  title="Click to Play (Space)"
                >
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1 text-white" />
                </button>
              )}

              {/* Sleek Floating Video Controls with Rotate Option */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col gap-2 transition-opacity z-20">
                {/* Progress Bar Scrubber */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={videoProgress}
                  onChange={handleSeek}
                  className="w-full h-1.5 sm:h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2.5 transition-all"
                />

                <div className="flex items-center justify-between text-white text-xs flex-wrap gap-2">
                  {/* Left Controls: Play/Pause, Volume, Time */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-1.5 sm:p-2 rounded-xl bg-white/15 hover:bg-white/30 transition-all active:scale-95 cursor-pointer"
                      title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      className="p-1.5 sm:p-2 rounded-xl bg-white/15 hover:bg-white/30 transition-all active:scale-95 cursor-pointer"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <span className="font-mono text-[11px] sm:text-xs font-semibold text-white/90">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Controls: Rotate Video Button + Speed Selector + Fullscreen */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Rotate Video Button */}
                    <button
                      type="button"
                      onClick={handleRotateVideo}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
                      title="Rotate Video 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{videoRotation ? `${videoRotation}°` : 'Rotate'}</span>
                    </button>

                    {/* Playback speed selector (Desktop) */}
                    <select
                      value={playbackRate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                      }}
                      className="hidden sm:inline-block bg-white/15 border border-white/20 text-white rounded-xl text-xs px-2.5 py-1 font-bold outline-none cursor-pointer hover:bg-white/25 transition-colors"
                      title="Playback Speed"
                    >
                      <option value="0.5" className="bg-foreground">0.5x</option>
                      <option value="1" className="bg-foreground">1.0x</option>
                      <option value="1.25" className="bg-foreground">1.25x</option>
                      <option value="1.5" className="bg-foreground">1.5x</option>
                      <option value="2" className="bg-foreground">2.0x</option>
                    </select>

                    {/* Switch to Full Screen / Mobile Native Player */}
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-md active:scale-95 border border-white/20 cursor-pointer"
                      title="Switch to Full Screen (F)"
                    >
                      {isFullscreen ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Exit Fullscreen</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Fullscreen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <img
              src={currentMediaUrl}
              alt={currentItem.filename || 'Photo'}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: isDragging || isGesturingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
              }}
              draggable={false}
              className="max-h-full max-w-full object-contain sm:rounded-2xl shadow-2xl pointer-events-auto select-none"
            />
          )}
        </div>

        {/* Right Navigation Arrow (Desktop only) */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="hidden sm:flex absolute right-2 sm:right-6 z-30 p-3 sm:p-4 rounded-3xl bg-white/10 hover:bg-white/25 border border-white/20 text-white backdrop-blur-xl shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer group items-center justify-center"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM THUMBNAIL FILMSTRIP (Desktop only)                              */}
      {/* ========================================================================= */}
      <div className="relative z-30 shrink-0 hidden sm:flex px-4 py-2.5 bg-black/90 backdrop-blur-xl border-t border-white/10 flex-col items-center gap-1.5">
        <div
          ref={filmstripRef}
          className="flex items-center gap-2 max-w-full overflow-x-auto py-0.5 px-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
        >
          {items.map((item, idx) => {
            const isSelected = idx === currentIndex;
            const isItemVideo = item.mediaType === 'VIDEO';

            return (
              <button
                key={item.id}
                ref={isSelected ? activeThumbnailRef : null}
                type="button"
                onClick={() => handleIndexChange(idx)}
                className={`relative w-13 h-10 sm:w-16 sm:h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/40 scale-105 shadow-lg'
                    : 'border-white/20 opacity-50 hover:opacity-90 hover:border-white/50'
                }`}
              >
                {isItemVideo ? (
                  <div className="w-full h-full bg-foreground flex items-center justify-center">
                    <Film className="w-4 h-4 text-primary/80" />
                  </div>
                ) : (
                  <img
                    src={item.secureUrl || item.url}
                    alt={item.filename || 'Thumb'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {isItemVideo && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

