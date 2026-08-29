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
} from 'lucide-react';

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
  isAdmin = false,
}: UniversalMediaPlayerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);

  // UI Visibility State (auto-hides after 3s of inactivity with bottom-down transition)
  const [isUiVisible, setIsUiVisible] = useState(true);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Video Double-Tap & Single-Tap Engine State
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const [feedbackIcon, setFeedbackIcon] = useState<'play' | 'pause' | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Device orientation state (landscape detection on mobile)
  const [isDeviceLandscape, setIsDeviceLandscape] = useState(false);

  // Swipe-to-dismiss drag offset (when zoom is 1)
  const [swipeDismissOffset, setSwipeDismissOffset] = useState({ x: 0, y: 0, opacity: 1 });

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

  // Bottom filmstrip ref for auto-scrolling active thumbnail into view
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Image ref & container ref
  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Gesture tracking mutable state
  const stateRef = useRef({
    zoom: 1,
    pan: { x: 0, y: 0 },
    rotation: 0,
  });
  stateRef.current = { zoom, pan, rotation };

  // Touch gesture tracker refs
  const touchStateRef = useRef<{
    isPinching: boolean;
    isPanning: boolean;
    isSwiping: boolean;
    initialDist: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    focalPoint: { x: number; y: number };
    touchStart: { x: number; y: number; time: number };
    lastTap: { x: number; y: number; time: number };
  }>({
    isPinching: false,
    isPanning: false,
    isSwiping: false,
    initialDist: 0,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    focalPoint: { x: 0, y: 0 },
    touchStart: { x: 0, y: 0, time: 0 },
    lastTap: { x: 0, y: 0, time: 0 },
  });

  // Mouse drag state
  const mouseDragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // SSR Safe Mounted Check
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 3-second auto-hide scheduler for all player options
  const schedule3sAutoHide = useCallback(() => {
    if (uiTimerRef.current) {
      clearTimeout(uiTimerRef.current);
    }
    uiTimerRef.current = setTimeout(() => {
      setIsUiVisible(false);
    }, 3000);
  }, []);

  // Show controls temporarily and restart the 3s countdown
  const showControlsTemporarily = useCallback(() => {
    setIsUiVisible(true);
    schedule3sAutoHide();
  }, [schedule3sAutoHide]);

  // Brief visual feedback ripple on double-tap play/pause
  const triggerPlayFeedback = useCallback((type: 'play' | 'pause') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackIcon(type);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackIcon(null);
    }, 450);
  }, []);

  // Detect mobile device orientation & auto-rotation
  useEffect(() => {
    const updateOrientation = () => {
      if (typeof window === 'undefined') return;
      const isLandscape =
        window.matchMedia('(orientation: landscape)').matches &&
        window.innerWidth > window.innerHeight &&
        window.innerHeight < 700;
      setIsDeviceLandscape(isLandscape);
      if (isLandscape) {
        // Reset manual 90° rotation to 0 in physical landscape mode
        setRotation(0);
        setVideoRotation(0);
      }
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    const mql = window.matchMedia('(orientation: landscape)');
    mql.addEventListener('change', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      mql.removeEventListener('change', updateOrientation);
    };
  }, []);

  // UI Reappearance Scheduler (hides immediately on hold, reappears 1s after release)
  const hideUiDuringInteraction = useCallback(() => {
    if (uiTimerRef.current) {
      clearTimeout(uiTimerRef.current);
      uiTimerRef.current = null;
    }
    setIsUiVisible(false);
  }, []);

  const scheduleUiReappear = useCallback(() => {
    if (uiTimerRef.current) {
      clearTimeout(uiTimerRef.current);
    }
    uiTimerRef.current = setTimeout(() => {
      setIsUiVisible(true);
      schedule3sAutoHide();
    }, 1000);
  }, [schedule3sAutoHide]);

  // Helper: Clamp pan bounds based on zoom
  const clampPan = useCallback((targetPan: { x: number; y: number }, targetZoom: number) => {
    if (targetZoom <= 1.02) {
      return { x: 0, y: 0 };
    }
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxX = ((targetZoom - 1) * vw) / 2 + 50;
    const maxY = ((targetZoom - 1) * vh) / 2 + 50;

    return {
      x: Math.max(-maxX, Math.min(maxX, targetPan.x)),
      y: Math.max(-maxY, Math.min(maxY, targetPan.y)),
    };
  }, []);

  // Reset all transform values
  const resetTransform = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setIsInteracting(false);
    setIsUiVisible(true);
    schedule3sAutoHide();
    setSwipeDismissOffset({ x: 0, y: 0, opacity: 1 });
    setIsPlaying(false);
    setVideoProgress(0);
    setVideoRotation(0);
  }, [schedule3sAutoHide]);

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
      resetTransform();
    }
  }, [isOpen, initialIndex, items.length, resetTransform]);

  const currentItem = items[currentIndex];

  // Handle index switching
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

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.5, 4.5));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => {
          const next = Math.max(z - 0.5, 1);
          if (next <= 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        resetTransform();
      } else if (e.key === ' ' && currentItem?.mediaType === 'VIDEO') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, currentItem, resetTransform]);

  // Auto-scroll active thumbnail into view in filmstrip
  useEffect(() => {
    if (activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Zoom Button Handlers
  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.5, 4.5));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.5, 1);
      if (next <= 1.05) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      setPan((p) => clampPan(p, next));
      return next;
    });
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  // Double Click / Double Tap Handler (Smoothly toggle between 1x and 2.5x for photos)
  const handleDoubleTap = (clientX?: number, clientY?: number) => {
    if (currentItem?.mediaType === 'VIDEO') {
      return;
    }

    if (zoom > 1.1) {
      // Zoomed in -> Smoothly reset to original centered position
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      // Zoomed out -> Zoom in to 2.5x centered at tap/click point
      const targetZoom = 2.5;
      if (clientX !== undefined && clientY !== undefined && typeof window !== 'undefined') {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const focalX = (cx - clientX) * (targetZoom - 1);
        const focalY = (cy - clientY) * (targetZoom - 1);
        const clamped = clampPan({ x: focalX, y: focalY }, targetZoom);
        setZoom(targetZoom);
        setPan(clamped);
      } else {
        setZoom(targetZoom);
        setPan({ x: 0, y: 0 });
      }
    }
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (currentItem?.mediaType === 'VIDEO') return;
    e.preventDefault();

    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    const currentZ = stateRef.current.zoom;
    const nextZ = Math.min(Math.max(currentZ + delta, 1), 4.5);

    if (nextZ <= 1.02) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Adjust pan toward cursor
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const mouseX = e.clientX - cx;
    const mouseY = e.clientY - cy;
    const scaleFactor = nextZ / currentZ;

    const newPan = {
      x: mouseX - (mouseX - stateRef.current.pan.x) * scaleFactor,
      y: mouseY - (mouseY - stateRef.current.pan.y) * scaleFactor,
    };

    setZoom(nextZ);
    setPan(clampPan(newPan, nextZ));
  };

  // Mouse Drag (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentItem?.mediaType === 'VIDEO') return;
    if (zoom <= 1) return;

    hideUiDuringInteraction();
    setIsInteracting(true);
    mouseDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDragRef.current.isDragging || zoom <= 1) return;
    const dx = e.clientX - mouseDragRef.current.startX;
    const dy = e.clientY - mouseDragRef.current.startY;
    const nextPan = clampPan(
      {
        x: mouseDragRef.current.startPanX + dx,
        y: mouseDragRef.current.startPanY + dy,
      },
      zoom
    );
    setPan(nextPan);
  };

  const handleMouseUp = () => {
    if (mouseDragRef.current.isDragging) {
      mouseDragRef.current.isDragging = false;
      setIsInteracting(false);
      scheduleUiReappear();
    }
  };

  // Touch Gesture Engine (Mobile Pinch, Pan, Double-Tap, Swipe)
  useEffect(() => {
    const el = imageContainerRef.current;
    if (!isOpen || !el || currentItem?.mediaType === 'VIDEO') return;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      // Hide UI immediately when user holds / touches picture
      hideUiDuringInteraction();

      if (e.touches.length === 2) {
        e.preventDefault();
        setIsInteracting(true);
        const dist = getDistance(e.touches[0], e.touches[1]);
        const center = getCenter(e.touches[0], e.touches[1]);

        touchStateRef.current = {
          ...touchStateRef.current,
          isPinching: true,
          isPanning: false,
          isSwiping: false,
          initialDist: dist,
          initialZoom: stateRef.current.zoom,
          initialPan: { ...stateRef.current.pan },
          focalPoint: center,
        };
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - touchStateRef.current.lastTap.time;
        const distFromLastTap = Math.hypot(
          touch.clientX - touchStateRef.current.lastTap.x,
          touch.clientY - touchStateRef.current.lastTap.y
        );

        // Double tap detection
        if (timeSinceLastTap < 280 && distFromLastTap < 30) {
          e.preventDefault();
          handleDoubleTap(touch.clientX, touch.clientY);
          touchStateRef.current.lastTap = { x: 0, y: 0, time: 0 };
          scheduleUiReappear();
          return;
        }

        touchStateRef.current.lastTap = {
          x: touch.clientX,
          y: touch.clientY,
          time: now,
        };

        setIsInteracting(true);
        touchStateRef.current = {
          ...touchStateRef.current,
          isPinching: false,
          isPanning: stateRef.current.zoom > 1.05,
          isSwiping: stateRef.current.zoom <= 1.05,
          initialZoom: stateRef.current.zoom,
          initialPan: { ...stateRef.current.pan },
          touchStart: { x: touch.clientX, y: touch.clientY, time: now },
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      hideUiDuringInteraction();
      const ts = touchStateRef.current;

      if (e.touches.length === 2 && ts.isPinching && ts.initialDist > 0) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const scaleRatio = dist / ts.initialDist;
        let nextZoom = ts.initialZoom * scaleRatio;

        // Apply resistance when below 1x or above 4.5x
        if (nextZoom < 1) {
          nextZoom = 1 - (1 - nextZoom) * 0.4;
        } else if (nextZoom > 4.5) {
          nextZoom = 4.5 + (nextZoom - 4.5) * 0.4;
        }

        // Adjust pan to zoom into pinch center
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const fx = ts.focalPoint.x - cx;
        const fy = ts.focalPoint.y - cy;
        const factor = nextZoom / ts.initialZoom;

        const nextPan = {
          x: fx - (fx - ts.initialPan.x) * factor,
          y: fy - (fy - ts.initialPan.y) * factor,
        };

        setZoom(nextZoom);
        setPan(clampPan(nextPan, nextZoom));
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - ts.touchStart.x;
        const dy = touch.clientY - ts.touchStart.y;

        if (ts.isPanning && stateRef.current.zoom > 1.05) {
          e.preventDefault();
          const nextPan = {
            x: ts.initialPan.x + dx,
            y: ts.initialPan.y + dy,
          };
          setPan(clampPan(nextPan, stateRef.current.zoom));
        } else if (ts.isSwiping && stateRef.current.zoom <= 1.05) {
          // Swipe down to dismiss preview
          if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
            const dragProgress = Math.min(dy / 250, 1);
            setSwipeDismissOffset({
              x: dx * 0.3,
              y: dy,
              opacity: Math.max(1 - dragProgress * 0.6, 0.4),
            });
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const ts = touchStateRef.current;

      if (e.touches.length === 0) {
        setIsInteracting(false);
        // After user releases picture, gradually reappear all buttons after 1 second
        scheduleUiReappear();

        // If pinched below 1x, smoothly animate back to 1x and {0, 0}
        if (stateRef.current.zoom < 1.05) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else if (stateRef.current.zoom > 4.5) {
          setZoom(4.5);
          setPan((p) => clampPan(p, 4.5));
        } else {
          setPan((p) => clampPan(p, stateRef.current.zoom));
        }

        // Check for swipe dismiss or navigation if at 1x
        if (ts.isSwiping && stateRef.current.zoom <= 1.05) {
          const touch = e.changedTouches[0];
          if (touch) {
            const dx = touch.clientX - ts.touchStart.x;
            const dy = touch.clientY - ts.touchStart.y;
            const dt = Date.now() - ts.touchStart.time;

            if (dy > 90 && Math.abs(dy) > Math.abs(dx) && dt < 450) {
              onClose();
            } else if (dx < -60 && Math.abs(dx) > Math.abs(dy) && dt < 450) {
              handleNext();
            } else if (dx > 60 && Math.abs(dx) > Math.abs(dy) && dt < 450) {
              handlePrev();
            }
          }
        }

        setSwipeDismissOffset({ x: 0, y: 0, opacity: 1 });
        touchStateRef.current.isPinching = false;
        touchStateRef.current.isPanning = false;
        touchStateRef.current.isSwiping = false;
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
  }, [isOpen, currentItem?.mediaType, clampPan, handleNext, handlePrev, onClose, hideUiDuringInteraction, scheduleUiReappear]);

  // Video Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      triggerPlayFeedback('play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerPlayFeedback('pause');
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleRotateVideo = () => {
    setVideoRotation((prev) => (prev + 90) % 360);
  };

  // Video Tap Handler: Single-tap toggles UI, Double-tap plays/pauses cleanly
  const handleVideoTapOrClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const timeSinceLast = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (timeSinceLast < 300) {
      // DOUBLE TAP DETECTED: Pause / Resume video without appearing any buttons
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
          triggerPlayFeedback('play');
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
          triggerPlayFeedback('pause');
        }
      }
    } else {
      // SINGLE TAP CANDIDATE -> Wait 300ms to verify not double tap
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        setIsUiVisible((prev) => {
          const nextState = !prev;
          if (nextState) {
            schedule3sAutoHide();
          } else {
            if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
          }
          return nextState;
        });
      }, 300);
    }
  };

  if (!isOpen || !currentItem || !mounted) return null;

  const currentMediaUrl = currentItem.secureUrl || currentItem.url;
  const isVideo = currentItem.mediaType === 'VIDEO';

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] bg-black flex flex-col h-screen w-screen min-h-[100dvh] select-none animate-in fade-in duration-200 overflow-hidden"
      onMouseMove={() => {
        if (!isVideo) showControlsTemporarily();
      }}
      onMouseUp={handleMouseUp}
    >
      {/* ========================================================================= */}
      {/* 1. MOBILE FLOATING CONTROLS (Disappears on inactivity, slides up)         */}
      {/* ========================================================================= */}
      <div
        className={`sm:hidden absolute top-4 inset-x-4 z-50 flex items-center justify-between transition-all duration-300 ease-in-out ${
          isUiVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        {/* Left: Mobile Rotate / Back to Portrait Button */}
        {!isDeviceLandscape ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isVideo) {
                handleRotateVideo();
              } else {
                if (rotation === 0) handleRotate();
                else setRotation(0);
              }
              showControlsTemporarily();
            }}
            className={`pointer-events-auto h-11 px-4 rounded-full backdrop-blur-xl border shadow-2xl active:scale-90 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer ${
              (isVideo ? videoRotation !== 0 : rotation !== 0)
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400/60 ring-2 ring-amber-400/40'
                : 'bg-black/75 hover:bg-black/90 text-white border-white/25'
            }`}
            title={(isVideo ? videoRotation !== 0 : rotation !== 0) ? 'Back to Portrait (0°)' : 'Rotate 90°'}
          >
            <RotateCw className={`w-4 h-4 shrink-0 ${(isVideo ? videoRotation !== 0 : rotation !== 0) ? 'rotate-180 text-white' : ''}`} />
            <span>{(isVideo ? videoRotation !== 0 : rotation !== 0) ? 'Back to Portrait' : 'Rotate'}</span>
          </button>
        ) : (
          <div />
        )}

        {/* Right: Mobile Close / Cancel Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto w-11 h-11 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-xl border border-white/25 shadow-2xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
          title="Close Viewer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP TOP FLOATING CONTROL BAR                                       */}
      {/* ========================================================================= */}
      <div
        className={`relative z-30 shrink-0 hidden sm:flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 text-white border-b border-white/10 bg-black/40 backdrop-blur-md transition-all duration-300 ease-in-out ${
          isUiVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          showControlsTemporarily();
        }}
      >
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
                disabled={zoom <= 1}
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
                disabled={zoom >= 4.5}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={rotation === 0 ? handleRotate : () => setRotation(0)}
                className={`p-1.5 rounded-xl transition-all ml-0.5 cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                  rotation !== 0
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`}
                title={rotation !== 0 ? 'Back to Portrait (0°)' : 'Rotate 90°'}
              >
                <RotateCw className="w-4 h-4" />
                {rotation !== 0 && <span className="text-[10px] hidden md:inline">Portrait</span>}
              </button>

              <button
                type="button"
                onClick={resetTransform}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all ml-0.5 cursor-pointer text-[10px] font-bold"
                title="Reset to 16:9 View (0)"
              >
                16:9
              </button>
            </div>
          )}

          {/* Video Desktop Rotate Button */}
          {isVideo && (
            <div className="flex items-center bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl p-1 shadow-lg">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotateVideo();
                  showControlsTemporarily();
                }}
                className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                  videoRotation !== 0
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`}
                title={videoRotation !== 0 ? 'Back to Portrait (0°)' : 'Rotate Video 90°'}
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[10px] hidden md:inline">{videoRotation !== 0 ? 'Portrait' : 'Rotate'}</span>
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
      {/* 3. MAIN STAGE: VIDEO PLAYER & PHOTO ZOOM CANVAS                           */}
      {/* ========================================================================= */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden p-0"
        onWheel={handleWheel}
      >
        {/* Left Navigation Arrow (Desktop only) */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className={`hidden sm:flex absolute left-2 sm:left-6 z-30 p-3 sm:p-4 rounded-3xl bg-white/10 hover:bg-white/25 border border-white/20 text-white backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group items-center justify-center ${
              isUiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
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
          onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
          style={{
            cursor: zoom > 1 ? (isInteracting ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {isVideo ? (
            /* Expansive Full-Stage Video Player Container */
            <div
              ref={videoContainerRef}
              className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black select-none"
              onClick={handleVideoTapOrClick}
            >
              <video
                ref={videoRef}
                src={currentMediaUrl}
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                style={{
                  transform: videoRotation ? `rotate(${videoRotation}deg)` : undefined,
                  width: videoRotation % 180 !== 0
                    ? 'calc(min(98dvh, 98dvw * 16 / 9))'
                    : isDeviceLandscape
                    ? 'calc(min(98dvw, 96dvh * 16 / 9))'
                    : '100%',
                  height: videoRotation % 180 !== 0
                    ? 'calc(min(98dvw, 98dvh * 9 / 16))'
                    : isDeviceLandscape
                    ? '96dvh'
                    : '100%',
                  maxWidth: videoRotation % 180 !== 0
                    ? 'calc(min(98dvh, 98dvw * 16 / 9))'
                    : isDeviceLandscape
                    ? 'calc(min(98dvw, 96dvh * 16 / 9))'
                    : '100%',
                  maxHeight: videoRotation % 180 !== 0
                    ? 'calc(min(98dvw, 98dvh * 9 / 16))'
                    : isDeviceLandscape
                    ? '96dvh'
                    : '100%',
                  aspectRatio: videoRotation % 180 !== 0 || isDeviceLandscape ? '16 / 9' : undefined,
                  objectFit: 'contain',
                  transition: 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
                }}
                className="object-contain cursor-pointer select-none"
              />

              {/* Subtle Double-Tap Play/Pause Feedback Bubble */}
              {feedbackIcon && (
                <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl animate-in zoom-in-75 fade-in duration-150 pointer-events-none z-30">
                  {feedbackIcon === 'play' ? (
                    <Play className="w-8 h-8 fill-white ml-0.5" />
                  ) : (
                    <Pause className="w-8 h-8 fill-white" />
                  )}
                </div>
              )}

              {/* Sleek Floating Video Controls (Smooth bottom-down transition & Large Clickable Touch Targets) */}
              <div
                className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 transition-all duration-300 ease-in-out z-20 ${
                  isUiVisible
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-full pointer-events-none'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  showControlsTemporarily();
                }}
              >
                {/* Progress Bar Scrubber */}
                <div className="py-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={videoProgress}
                    onChange={(e) => {
                      handleSeek(e);
                      showControlsTemporarily();
                    }}
                    className="w-full h-2.5 sm:h-3 bg-white/30 hover:bg-white/40 rounded-full appearance-none cursor-pointer accent-blue-500 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-white flex-wrap gap-2.5">
                  {/* Left Controls: Play/Pause, Volume, Time */}
                  <div className="flex items-center gap-2.5 sm:gap-3.5">
                    {/* Big Touch-Friendly Play/Pause Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                        showControlsTemporarily();
                      }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/25 backdrop-blur-md flex items-center justify-center text-white shadow-lg active:scale-90 transition-all cursor-pointer"
                      title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                      {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />}
                    </button>

                    {/* Big Touch-Friendly Mute/Volume Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                        showControlsTemporarily();
                      }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/25 backdrop-blur-md flex items-center justify-center text-white shadow-lg active:scale-90 transition-all cursor-pointer"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    <span className="font-mono text-xs sm:text-sm font-bold text-white/95 px-1 tracking-wide">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Controls: Large Rotate Video Button + Speed Selector */}
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    {/* Big Touch-Friendly Rotate Video Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotateVideo();
                        showControlsTemporarily();
                      }}
                      className={`h-11 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-90 cursor-pointer border shadow-lg ${
                        videoRotation !== 0
                          ? 'bg-amber-500 hover:bg-amber-600 border-amber-400/60 ring-2 ring-amber-400/40'
                          : 'bg-white/20 hover:bg-white/30 border-white/25 backdrop-blur-md'
                      }`}
                      title="Rotate Video 90°"
                    >
                      <RotateCw className={`w-4 h-4 ${videoRotation !== 0 ? 'rotate-180 text-white' : ''}`} />
                      <span>{videoRotation ? `${videoRotation}°` : 'Rotate'}</span>
                    </button>

                    {/* Playback speed selector (Desktop) */}
                    <select
                      value={playbackRate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                        showControlsTemporarily();
                      }}
                      className="hidden sm:inline-block h-11 bg-white/20 border border-white/25 backdrop-blur-md text-white rounded-2xl text-xs sm:text-sm px-3.5 font-bold outline-none cursor-pointer hover:bg-white/30 transition-colors shadow-lg"
                      title="Playback Speed"
                    >
                      <option value="0.5" className="bg-foreground">0.5x</option>
                      <option value="1" className="bg-foreground">1.0x</option>
                      <option value="1.25" className="bg-foreground">1.25x</option>
                      <option value="1.5" className="bg-foreground">1.5x</option>
                      <option value="2" className="bg-foreground">2.0x</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={currentMediaUrl}
              alt={currentItem.filename || 'Photo'}
              style={{
                transform: `translate3d(${pan.x + swipeDismissOffset.x}px, ${pan.y + swipeDismissOffset.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                opacity: swipeDismissOffset.opacity,
                transformOrigin: 'center center',
                width: rotation % 180 !== 0
                  ? 'calc(min(98dvh, 98dvw * 16 / 9))'
                  : isDeviceLandscape
                  ? 'calc(min(98dvw, 96dvh * 16 / 9))'
                  : undefined,
                height: rotation % 180 !== 0
                  ? 'calc(min(98dvw, 98dvh * 9 / 16))'
                  : isDeviceLandscape
                  ? '94dvh'
                  : undefined,
                maxWidth: rotation % 180 !== 0
                  ? 'calc(min(98dvh, 98dvw * 16 / 9))'
                  : isDeviceLandscape
                  ? 'calc(min(98dvw, 96dvh * 16 / 9))'
                  : '100%',
                maxHeight: rotation % 180 !== 0
                  ? 'calc(min(98dvw, 98dvh * 9 / 16))'
                  : isDeviceLandscape
                  ? '94dvh'
                  : '100%',
                aspectRatio: rotation % 180 !== 0 || isDeviceLandscape ? '16 / 9' : undefined,
                objectFit: 'contain',
                transition: isInteracting
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
              }}
              draggable={false}
              className="object-contain sm:rounded-2xl shadow-2xl pointer-events-auto select-none"
            />
          )}
        </div>

        {/* Right Navigation Arrow (Desktop only) */}
        {items.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className={`hidden sm:flex absolute right-2 sm:right-6 z-30 p-3 sm:p-4 rounded-3xl bg-white/10 hover:bg-white/25 border border-white/20 text-white backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group items-center justify-center ${
              isUiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM THUMBNAIL FILMSTRIP (Desktop only)                              */}
      {/* ========================================================================= */}
      {items.length > 1 && (
        <div
          className={`relative z-30 shrink-0 hidden sm:flex px-4 py-2.5 bg-black/90 backdrop-blur-xl border-t border-white/10 flex-col items-center gap-1.5 transition-all duration-300 ease-in-out ${
            isUiVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-full pointer-events-none'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            showControlsTemporarily();
          }}
        >
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
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

