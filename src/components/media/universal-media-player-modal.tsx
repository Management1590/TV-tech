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

const MAX_ZOOM = 10.0;
const MIN_ZOOM = 1.0;

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

  // UI Visibility State (auto-hides after 3s of inactivity for desktop & video HUD)
  const [isUiVisible, setIsUiVisible] = useState(true);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Floating Header Controls Visibility (Rotate & Close buttons)
  const [isFloatingControlsVisible, setIsFloatingControlsVisible] = useState(true);
  const floatingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Video Double-Tap & Single-Tap Engine State
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const [feedbackIcon, setFeedbackIcon] = useState<'play' | 'pause' | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Device orientation state (landscape detection on mobile)
  const [isDeviceLandscape, setIsDeviceLandscape] = useState(false);

  // Real-time horizontal slide offset (px) for smooth iOS-style swipe transitions
  const [slideOffset, setSlideOffset] = useState(0);
  const [isSlideAnimating, setIsSlideAnimating] = useState(false);
  const isTransitioningRef = useRef(false);

  // iOS-style Swipe-to-dismiss drag offset & scaling
  const [dismissOffset, setDismissOffset] = useState({ x: 0, y: 0, scale: 1, opacity: 1 });
  const [isDismissing, setIsDismissing] = useState(false);

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

  // Map storing playback progress timestamp (in seconds) for each video
  const videoPlaybackPositionsRef = useRef<Record<string, number>>({});

  // Bottom filmstrip ref for auto-scrolling active thumbnail into view
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);

  // Image ref & container ref
  const modalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Gesture tracking mutable state
  const stateRef = useRef({
    zoom: 1,
    pan: { x: 0, y: 0 },
    rotation: 0,
  });
  stateRef.current = { zoom, pan, rotation };

  // Touch gesture tracker refs with dynamic center tracking
  const touchStateRef = useRef<{
    isPinching: boolean;
    isPanning: boolean;
    gestureType: 'pan' | 'horizontal-slide' | 'vertical-dismiss' | null;
    initialDist: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    initialCenter: { x: number; y: number };
    touchStart: { x: number; y: number; time: number };
    lastTap: { x: number; y: number; time: number };
    lastTouchesCount: number;
  }>({
    isPinching: false,
    isPanning: false,
    gestureType: null,
    initialDist: 0,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    initialCenter: { x: 0, y: 0 },
    touchStart: { x: 0, y: 0, time: 0 },
    lastTap: { x: 0, y: 0, time: 0 },
    lastTouchesCount: 0,
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

  // Inertia physics animation & velocity tracking refs
  const inertiaAnimationRef = useRef<number | null>(null);
  const velocityTrackerRef = useRef<{ x: number; y: number; time: number }[]>([]);

  // SSR Safe Mounted Check
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mode detections for button visibility
  const isLandscapeMode = isDeviceLandscape || (items[currentIndex]?.mediaType === 'VIDEO' ? videoRotation % 180 !== 0 : rotation % 180 !== 0);
  const isZoomedView = zoom > 1.05;
  const isDynamicHideMode = isLandscapeMode || isZoomedView;
  const isVideoCurrent = items[currentIndex]?.mediaType === 'VIDEO';

  // For Video: Top bar and controls toggle simultaneously on single-tap and auto-hide (isUiVisible)
  // For Photo: In portrait fit mode: permanently visible. In landscape or zoomed view: hides on touch, reappears after 1s.
  const isMobileHeaderVisible = isVideoCurrent
    ? isUiVisible
    : !isDynamicHideMode
    ? true
    : isFloatingControlsVisible;

  // Floating controls hide/reappear handlers
  const hideFloatingControls = useCallback(() => {
    if (floatingTimerRef.current) {
      clearTimeout(floatingTimerRef.current);
      floatingTimerRef.current = null;
    }
    setIsFloatingControlsVisible(false);
  }, []);

  const scheduleFloatingControlsReappear = useCallback(() => {
    if (floatingTimerRef.current) {
      clearTimeout(floatingTimerRef.current);
    }
    floatingTimerRef.current = setTimeout(() => {
      setIsFloatingControlsVisible(true);
    }, 1000); // exactly 1 second smooth reappear after touch ends
  }, []);

  // 3-second auto-hide scheduler for video controls & desktop controls
  const schedule3sAutoHide = useCallback(() => {
    if (uiTimerRef.current) {
      clearTimeout(uiTimerRef.current);
    }
    uiTimerRef.current = setTimeout(() => {
      setIsUiVisible(false);
    }, 3000);
  }, []);

  // Show controls temporarily and restart the countdown
  const showControlsTemporarily = useCallback(() => {
    setIsUiVisible(true);
    setIsFloatingControlsVisible(true);
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

  // Helper: Compute exact unscaled rendered dimensions of current photo
  const getImageBounds = useCallback(() => {
    const img = imgRef.current;
    const container = imageContainerRef.current;

    const vw = container?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000);
    const vh = container?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);

    // Padding & safe-area margins applied in style: 16px horizontal, 32px vertical
    const availW = Math.max(10, vw - 16);
    const availH = Math.max(10, vh - 32);

    let baseW = availW;
    let baseH = availH;

    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      let natW = img.naturalWidth;
      let natH = img.naturalHeight;

      // Invert natural aspect ratio when rotated 90 or 270 degrees
      if (rotation % 180 !== 0) {
        const temp = natW;
        natW = natH;
        natH = temp;
      }

      const fitScale = Math.min(availW / natW, availH / natH);
      baseW = natW * fitScale;
      baseH = natH * fitScale;
    } else if (img && img.clientWidth > 0 && img.clientHeight > 0) {
      baseW = rotation % 180 !== 0 ? img.clientHeight : img.clientWidth;
      baseH = rotation % 180 !== 0 ? img.clientWidth : img.clientHeight;
    }

    return { vw, vh, availW, availH, baseW, baseH };
  }, [rotation]);

  // Helper: Compute exact maximum pan bounds so the image corners/edges stay 100% INTACT with viewport edges
  const getMaxPan = useCallback((targetZoom: number) => {
    if (targetZoom <= 1.02) {
      return { maxX: 0, maxY: 0 };
    }

    const { vw, vh, baseW, baseH } = getImageBounds();

    const scaledW = baseW * targetZoom;
    const scaledH = baseH * targetZoom;

    // The image can pan so long as its scaled dimension exceeds the viewport (vw / vh).
    // The maximum travel keeps the edge flush with the viewport edge — NEVER detaching into black void!
    const maxX = Math.max(0, (scaledW - vw) / 2);
    const maxY = Math.max(0, (scaledH - vh) / 2);

    return { maxX, maxY };
  }, [getImageBounds]);

  // Helper: Authentic iOS sublinear elastic rubber-band resistance when forcefully pulled past boundary
  const applyRubberBand = useCallback((val: number, maxVal: number, dimension = 800) => {
    if (maxVal <= 0) {
      // Constrained axis: tighter elastic excursion (max ~45px)
      const absVal = Math.abs(val);
      const sign = val >= 0 ? 1 : -1;
      const c = 0.45;
      const d = dimension * 0.35;
      return sign * ((absVal * d * c) / (d + c * absVal));
    }

    if (val > maxVal) {
      const overshoot = val - maxVal;
      const c = 0.55;
      const d = dimension * 0.5;
      const rubber = (overshoot * d * c) / (d + c * overshoot);
      return maxVal + rubber;
    }

    if (val < -maxVal) {
      const overshoot = -maxVal - val;
      const c = 0.55;
      const d = dimension * 0.5;
      const rubber = (overshoot * d * c) / (d + c * overshoot);
      return -maxVal - rubber;
    }

    return val;
  }, []);

  // Helper: Strictly clamp pan to valid boundary so corners remain 100% attached to viewport edges
  const clampPan = useCallback((targetPan: { x: number; y: number }, targetZoom: number) => {
    const { maxX, maxY } = getMaxPan(targetZoom);
    return {
      x: maxX > 0 ? Math.max(-maxX, Math.min(maxX, targetPan.x)) : 0,
      y: maxY > 0 ? Math.max(-maxY, Math.min(maxY, targetPan.y)) : 0,
    };
  }, [getMaxPan]);

  // Helper: Inertia glide physics engine (buttery-smooth flick deceleration with elastic boundary cushioning)
  const startInertiaGlide = useCallback((initialVx: number, initialVy: number, currentZoom: number) => {
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }

    const { maxX, maxY } = getMaxPan(currentZoom);

    // If both axes are constrained, snap cleanly to center and finish
    if (maxX <= 0 && maxY <= 0) {
      setPan({ x: 0, y: 0 });
      setIsInteracting(false);
      return;
    }

    // Convert velocity (px/ms) to px/frame (~16.6ms at 60fps)
    let vx = initialVx * 16.6;
    let vy = initialVy * 16.6;

    // Cap velocity for smooth, controllable feel
    const maxVelocity = 45;
    const initialSpeed = Math.hypot(vx, vy);
    if (initialSpeed > maxVelocity) {
      vx = (vx / initialSpeed) * maxVelocity;
      vy = (vy / initialSpeed) * maxVelocity;
    }

    let px = stateRef.current.pan.x;
    let py = stateRef.current.pan.y;

    // Keep CSS transition 'none' during physics frame updates
    setIsInteracting(true);

    const friction = 0.945; // Smooth deceleration curve

    const step = () => {
      vx *= friction;
      vy *= friction;

      px += vx;
      py += vy;

      // Elastic boundary cushioning when momentum hits the edge
      let hitBoundary = false;
      if (px > maxX) {
        px = maxX + (px - maxX) * 0.45;
        vx *= 0.35;
        hitBoundary = true;
      } else if (px < -maxX) {
        px = -maxX + (px - (-maxX)) * 0.45;
        vx *= 0.35;
        hitBoundary = true;
      }

      if (py > maxY) {
        py = maxY + (py - maxY) * 0.45;
        vy *= 0.35;
        hitBoundary = true;
      } else if (py < -maxY) {
        py = -maxY + (py - (-maxY)) * 0.45;
        vy *= 0.35;
        hitBoundary = true;
      }

      const currentSpeed = Math.hypot(vx, vy);

      // Stop condition: settled to low speed or cushioned at boundary -> springs cleanly back to boundary
      if (currentSpeed < 0.25 || (hitBoundary && currentSpeed < 1.0)) {
        setIsInteracting(false);
        setPan({
          x: maxX > 0 ? Math.max(-maxX, Math.min(maxX, px)) : 0,
          y: maxY > 0 ? Math.max(-maxY, Math.min(maxY, py)) : 0,
        });
        inertiaAnimationRef.current = null;
        return;
      }

      setPan({ x: px, y: py });
      inertiaAnimationRef.current = requestAnimationFrame(step);
    };

    inertiaAnimationRef.current = requestAnimationFrame(step);
  }, [getMaxPan]);

  // Reset all transform values
  const resetTransform = useCallback(() => {
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setIsInteracting(false);
    setIsUiVisible(true);
    setIsFloatingControlsVisible(true);
    schedule3sAutoHide();
    setSlideOffset(0);
    setIsSlideAnimating(false);
    setDismissOffset({ x: 0, y: 0, scale: 1, opacity: 1 });
    setIsDismissing(false);
    setVideoRotation(0);
  }, [schedule3sAutoHide]);

  // Cleanup inertia animation on unmount
  useEffect(() => {
    return () => {
      if (inertiaAnimationRef.current) {
        cancelAnimationFrame(inertiaAnimationRef.current);
      }
    };
  }, []);

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, items.length - 1)));
      resetTransform();
    }
  }, [isOpen, initialIndex, items.length, resetTransform]);

  // Stop and completely silence all video playback across all elements
  const stopAllVideos = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {}
    }
    if (typeof document !== 'undefined') {
      const allVids = document.querySelectorAll('video');
      allVids.forEach((v: HTMLVideoElement) => {
        try {
          v.pause();
          v.currentTime = 0;
        } catch {}
      });
    }
    setIsPlaying(false);
  }, []);

  // Dynamic Apple & Mobile Status Bar Theme Synchronization (Android Chrome + iOS Safari)
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    // 1. Force all theme-color tags to pure pitch black (#000000) and remove media query restrictions
    const existingMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]')) as HTMLMetaElement[];
    const originalThemes = existingMetas.map((m) => ({
      element: m,
      content: m.getAttribute('content'),
      media: m.getAttribute('media'),
    }));

    existingMetas.forEach((m) => {
      m.removeAttribute('media');
      m.setAttribute('content', '#000000');
    });

    let createdMeta: HTMLMetaElement | null = null;
    if (existingMetas.length === 0) {
      createdMeta = document.createElement('meta');
      createdMeta.name = 'theme-color';
      createdMeta.content = '#000000';
      document.head.appendChild(createdMeta);
    }

    // 2. iOS full notch immersion
    let metaAppleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
    const originalAppleStatus = metaAppleStatus ? metaAppleStatus.getAttribute('content') : null;
    if (!metaAppleStatus) {
      metaAppleStatus = document.createElement('meta');
      metaAppleStatus.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(metaAppleStatus);
    }
    metaAppleStatus.setAttribute('content', 'black-translucent');

    // 3. Set root HTML and body background to deep pitch black
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = '#000000';
    document.body.style.backgroundColor = '#000000';

    return () => {
      originalThemes.forEach(({ element, content, media }) => {
        if (content) element.setAttribute('content', content);
        if (media) element.setAttribute('media', media);
      });
      if (createdMeta) createdMeta.remove();

      if (originalAppleStatus !== null) {
        metaAppleStatus?.setAttribute('content', originalAppleStatus);
      } else {
        metaAppleStatus?.setAttribute('content', 'black-translucent');
      }

      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.style.backgroundColor = originalBodyBg;
    };
  }, [isOpen]);

  // Video Auto-Play & Resume Lifecycle Engine
  useEffect(() => {
    // Whenever index changes or modal closes, stop previous video immediately
    stopAllVideos();

    if (!isOpen) return;

    const current = items[currentIndex];
    if (current?.mediaType === 'VIDEO') {
      const vid = videoRef.current;
      if (vid) {
        const savedTime = videoPlaybackPositionsRef.current[current.id] || 0;
        if (savedTime > 0) {
          try {
            vid.currentTime = savedTime;
          } catch {}
        }
        const playPromise = vid.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      }
    }
  }, [isOpen, currentIndex, items, stopAllVideos]);

  const currentItem = items[currentIndex];

  // Handle direct index switching from filmstrip
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      if (newIndex === currentIndex) return;
      stopAllVideos();
      const boundedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
      setIsInteracting(false);
      setSlideOffset(0);
      setCurrentIndex(boundedIndex);
      resetTransform();
    },
    [currentIndex, items.length, resetTransform, stopAllVideos]
  );

  const handleNext = useCallback(() => {
    if (items.length <= 1 || currentIndex >= items.length - 1) return;
    stopAllVideos();
    setIsInteracting(false);
    setSlideOffset(0);
    setCurrentIndex((prev) => prev + 1);
    resetTransform();
  }, [currentIndex, items.length, resetTransform, stopAllVideos]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1 || currentIndex <= 0) return;
    stopAllVideos();
    setIsInteracting(false);
    setSlideOffset(0);
    setCurrentIndex((prev) => prev - 1);
    resetTransform();
  }, [currentIndex, items.length, resetTransform, stopAllVideos]);

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
        setZoom((z) => Math.min(z + 0.5, MAX_ZOOM));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => {
          const next = Math.max(z - 0.5, MIN_ZOOM);
          if (next <= 1.05) {
            setPan({ x: 0, y: 0 });
            return MIN_ZOOM;
          }
          setPan((p) => clampPan(p, next));
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
  }, [isOpen, handleNext, handlePrev, onClose, currentItem, resetTransform, clampPan]);

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
    setZoom((z) => Math.min(z + 0.5, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.5, MIN_ZOOM);
      if (next <= 1.05) {
        setPan({ x: 0, y: 0 });
        return MIN_ZOOM;
      }
      setPan((p) => clampPan(p, next));
      return next;
    });
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  // Double Click / Double Tap Handler (Smoothly toggle between 1x and fill-screen / detail zoom for photos)
  const handleDoubleTap = (clientX?: number, clientY?: number) => {
    if (currentItem?.mediaType === 'VIDEO') {
      return;
    }

    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }

    // Ensure CSS transition handles the smooth double-tap zoom glide
    setIsInteracting(false);

    if (zoom > 1.1) {
      // Zoomed in -> Smoothly reset to original centered position
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      // Zoomed out -> Zoom in to fill screen (so all corners reach edges) or 3x centered at tap/click point
      const { vw, vh, baseW, baseH } = getImageBounds();
      const coverScale = Math.max(vw / Math.max(1, baseW), vh / Math.max(1, baseH));
      const targetZoom = Math.min(MAX_ZOOM, Math.max(3.0, Math.ceil(coverScale * 10) / 10));

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

    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }

    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    const currentZ = stateRef.current.zoom;
    const nextZ = Math.min(Math.max(currentZ + delta, MIN_ZOOM), MAX_ZOOM);

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

    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }

    if (isDynamicHideMode) {
      hideFloatingControls();
    }
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
    const rawX = mouseDragRef.current.startPanX + dx;
    const rawY = mouseDragRef.current.startPanY + dy;
    const { maxX, maxY } = getMaxPan(zoom);
    const { vw, vh } = getImageBounds();
    setPan({
      x: applyRubberBand(rawX, maxX, vw),
      y: applyRubberBand(rawY, maxY, vh),
    });
  };

  const handleMouseUp = () => {
    if (mouseDragRef.current.isDragging) {
      mouseDragRef.current.isDragging = false;
      setIsInteracting(false);
      setPan((p) => clampPan(p, zoom));
      if (isDynamicHideMode) {
        scheduleFloatingControlsReappear();
      }
    }
  };

  // Touch Gesture Engine (Mobile Simultaneous Pinch + Multi-Directional Pan, Double-Tap, Swipe)
  useEffect(() => {
    const el = imageContainerRef.current;
    if (!isOpen || !el) return;

    const isCurrentVideo = items[currentIndex]?.mediaType === 'VIDEO';

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (isTransitioningRef.current) return;

      // Cancel any running inertia animation when new touch begins
      if (inertiaAnimationRef.current) {
        cancelAnimationFrame(inertiaAnimationRef.current);
        inertiaAnimationRef.current = null;
      }

      if (isDynamicHideMode && !isCurrentVideo) {
        hideFloatingControls();
      }

      if (e.touches.length === 2 && !isCurrentVideo) {
        e.preventDefault();
        setIsInteracting(true);
        setIsSlideAnimating(false);
        const dist = getDistance(e.touches[0], e.touches[1]);
        const center = getCenter(e.touches[0], e.touches[1]);

        touchStateRef.current = {
          ...touchStateRef.current,
          isPinching: true,
          isPanning: false,
          gestureType: 'pan',
          initialDist: dist,
          initialZoom: stateRef.current.zoom,
          initialPan: { ...stateRef.current.pan },
          initialCenter: center,
          lastTouchesCount: 2,
        };
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - touchStateRef.current.lastTap.time;
        const distFromLastTap = Math.hypot(
          touch.clientX - touchStateRef.current.lastTap.x,
          touch.clientY - touchStateRef.current.lastTap.y
        );

        // Reset velocity samples
        velocityTrackerRef.current = [{
          x: touch.clientX,
          y: touch.clientY,
          time: now,
        }];

        // Double tap detection for photos (quick toggle between 1x and 2.5x)
        if (!isCurrentVideo && timeSinceLastTap < 280 && distFromLastTap < 35) {
          e.preventDefault();
          handleDoubleTap(touch.clientX, touch.clientY);
          touchStateRef.current.lastTap = { x: 0, y: 0, time: 0 };
          if (isDynamicHideMode) {
            scheduleFloatingControlsReappear();
          }
          return;
        }

        touchStateRef.current.lastTap = {
          x: touch.clientX,
          y: touch.clientY,
          time: now,
        };

        setIsInteracting(true);
        setIsSlideAnimating(false);
        touchStateRef.current = {
          ...touchStateRef.current,
          isPinching: false,
          isPanning: !isCurrentVideo && stateRef.current.zoom > 1.02,
          gestureType: !isCurrentVideo && stateRef.current.zoom > 1.02 ? 'pan' : null,
          initialZoom: stateRef.current.zoom,
          initialPan: { ...stateRef.current.pan },
          touchStart: { x: touch.clientX, y: touch.clientY, time: now },
          lastTouchesCount: 1,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isTransitioningRef.current) return;
      if (isDynamicHideMode) {
        hideFloatingControls();
      }
      const ts = touchStateRef.current;

      // 2-Finger Pinch with simultaneous fluid pan / center translation
      if (e.touches.length === 2 && ts.isPinching && ts.initialDist > 0) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const currentCenter = getCenter(e.touches[0], e.touches[1]);

        const scaleRatio = dist / ts.initialDist;
        let nextZoom = ts.initialZoom * scaleRatio;

        // Fluid resistance when below 0.85x or above (MAX_ZOOM + 1)
        if (nextZoom < 0.85) {
          nextZoom = 0.85 - (0.85 - nextZoom) * 0.3;
        } else if (nextZoom > MAX_ZOOM + 1) {
          nextZoom = (MAX_ZOOM + 1) + (nextZoom - (MAX_ZOOM + 1)) * 0.3;
        }

        // Adjust pan to zoom into moving pinch midpoint (simultaneous zoom + pan)
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const fx = ts.initialCenter.x - cx;
        const fy = ts.initialCenter.y - cy;
        const factor = nextZoom / ts.initialZoom;

        const deltaCenterX = currentCenter.x - ts.initialCenter.x;
        const deltaCenterY = currentCenter.y - ts.initialCenter.y;

        const nextPan = {
          x: fx - (fx - ts.initialPan.x) * factor + deltaCenterX,
          y: fy - (fy - ts.initialPan.y) * factor + deltaCenterY,
        };

        const { maxX, maxY } = getMaxPan(nextZoom);
        const { vw, vh } = getImageBounds();
        setZoom(nextZoom);
        setPan({
          x: applyRubberBand(nextPan.x, maxX, vw),
          y: applyRubberBand(nextPan.y, maxY, vh),
        });
      } else if (e.touches.length === 1) {
        if (ts.lastTouchesCount === 2) {
          ts.lastTouchesCount = 1;
          ts.isPinching = false;
          ts.isPanning = stateRef.current.zoom > 1.02;
          ts.gestureType = stateRef.current.zoom > 1.02 ? 'pan' : null;
          ts.initialPan = { ...stateRef.current.pan };
          ts.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
          velocityTrackerRef.current = [{
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now(),
          }];
          return;
        }

        const touch = e.touches[0];
        const dx = touch.clientX - ts.touchStart.x;
        const dy = touch.clientY - ts.touchStart.y;

        // Fluid 360-degree pan in all directions when zoomed in with elastic boundary nature
        if (stateRef.current.zoom > 1.02) {
          e.preventDefault();

          // Track velocity positions for momentum glide
          const now = Date.now();
          const tracker = velocityTrackerRef.current;
          tracker.push({ x: touch.clientX, y: touch.clientY, time: now });
          while (tracker.length > 2 && now - tracker[0].time > 100) {
            tracker.shift();
          }

          const rawX = ts.initialPan.x + dx;
          const rawY = ts.initialPan.y + dy;

          const { maxX, maxY } = getMaxPan(stateRef.current.zoom);
          const { vw, vh } = getImageBounds();

          // Elastic nature when forcefully moved past boundary
          setPan({
            x: applyRubberBand(rawX, maxX, vw),
            y: applyRubberBand(rawY, maxY, vh),
          });
          return;
        }

        // When zoomed out (1x): Determine gesture direction after 7px of movement
        if (!ts.gestureType) {
          if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
            if (Math.abs(dx) >= Math.abs(dy)) {
              ts.gestureType = 'horizontal-slide';
            } else if (dy > 5) {
              ts.gestureType = 'vertical-dismiss';
            }
          }
        }

        if (ts.gestureType === 'horizontal-slide') {
          e.preventDefault();
          // Real-time horizontal track movement with rubber-banding at boundaries
          let currentOffset = dx;
          if (currentIndex === 0 && dx > 0) {
            currentOffset = dx * 0.32;
          } else if (currentIndex === items.length - 1 && dx < 0) {
            currentOffset = dx * 0.32;
          } else if (items.length <= 1) {
            currentOffset = dx * 0.32;
          }
          setSlideOffset(currentOffset);
        } else if (ts.gestureType === 'vertical-dismiss' && dy > 0) {
          e.preventDefault();
          // Smooth iOS Photos-style pull-down dismiss: scaling down, fading background
          const vh = window.innerHeight || 800;
          const progress = Math.min(dy / (vh * 0.75), 1);
          const scale = Math.max(1 - progress * 0.32, 0.68);
          const opacity = Math.max(1 - progress * 0.9, 0.0);

          setDismissOffset({
            x: dx * 0.35,
            y: dy,
            scale,
            opacity,
          });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const ts = touchStateRef.current;

      // If one finger remains on screen after 2-finger gesture
      if (e.touches.length === 1 && ts.isPinching) {
        ts.isPinching = false;
        ts.lastTouchesCount = 1;
        ts.isPanning = stateRef.current.zoom > 1.02;
        ts.gestureType = stateRef.current.zoom > 1.02 ? 'pan' : null;
        ts.initialPan = { ...stateRef.current.pan };
        ts.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
        velocityTrackerRef.current = [{
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now(),
        }];
        return;
      }

      if (e.touches.length === 0) {
        ts.lastTouchesCount = 0;

        // In landscape or zoomed view, smoothly reappear buttons 1 second after touch ends
        if (isDynamicHideMode) {
          scheduleFloatingControlsReappear();
        }

        // Snap back if pinched beyond limits
        if (stateRef.current.zoom < 1.02) {
          setIsInteracting(false);
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else if (stateRef.current.zoom > MAX_ZOOM) {
          setIsInteracting(false);
          setZoom(MAX_ZOOM);
          setPan((p) => clampPan(p, MAX_ZOOM));
        } else {
          // Zoomed in: Calculate release velocity for buttery-smooth momentum gliding
          const tracker = velocityTrackerRef.current;
          let vx = 0;
          let vy = 0;
          if (tracker.length >= 2) {
            const first = tracker[0];
            const last = tracker[tracker.length - 1];
            const dt = Math.max(last.time - first.time, 8);
            vx = (last.x - first.x) / dt;
            vy = (last.y - first.y) / dt;
          }

          const speed = Math.hypot(vx, vy);
          const { maxX, maxY } = getMaxPan(stateRef.current.zoom);
          const currentPan = stateRef.current.pan;
          const isOverExtendedX = currentPan.x > maxX || currentPan.x < -maxX;
          const isOverExtendedY = currentPan.y > maxY || currentPan.y < -maxY;

          if (speed > 0.15 && !isOverExtendedX && !isOverExtendedY && (maxX > 0 || maxY > 0)) {
            // Trigger buttery-smooth inertia glide with elastic cushioning
            startInertiaGlide(vx, vy, stateRef.current.zoom);
          } else {
            // Spring smoothly and elastically back to exact boundary!
            setIsInteracting(false);
            setPan(clampPan(currentPan, stateRef.current.zoom));
          }
        }

        const touch = e.changedTouches[0];
        if (touch && stateRef.current.zoom <= 1.02) {
          const dx = touch.clientX - ts.touchStart.x;
          const dy = touch.clientY - ts.touchStart.y;
          const dt = Math.max(Date.now() - ts.touchStart.time, 1);
          const velocityX = dx / dt;
          const velocityY = dy / dt;
          const vh = window.innerHeight || 800;

          if (ts.gestureType === 'horizontal-slide') {
            const shouldNext = (dx < -60 || velocityX < -0.35) && currentIndex < items.length - 1;
            const shouldPrev = (dx > 60 || velocityX > 0.35) && currentIndex > 0;

            if (shouldNext) {
              stopAllVideos();
              setSlideOffset(0);
              setCurrentIndex((prev) => prev + 1);
              resetTransform();
            } else if (shouldPrev) {
              stopAllVideos();
              setSlideOffset(0);
              setCurrentIndex((prev) => prev - 1);
              resetTransform();
            } else {
              // Spring back to center smoothly
              setSlideOffset(0);
            }
          } else if (ts.gestureType === 'vertical-dismiss') {
            const shouldDismiss = dy > 110 || (dy > 45 && velocityY > 0.45);

            if (shouldDismiss) {
              stopAllVideos();
              // Smoothly glide out down and close
              setIsDismissing(true);
              setDismissOffset({
                x: dx * 0.4,
                y: vh * 0.9,
                scale: 0.5,
                opacity: 0,
              });
              setTimeout(() => {
                onClose();
              }, 220);
            } else {
              // Spring smoothly back to center
              setIsDismissing(true);
              setDismissOffset({ x: 0, y: 0, scale: 1, opacity: 1 });
              setTimeout(() => setIsDismissing(false), 280);
            }
          }
        }

        ts.isPinching = false;
        ts.isPanning = false;
        ts.gestureType = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [
    isOpen,
    currentItem?.mediaType,
    isDynamicHideMode,
    clampPan,
    getMaxPan,
    applyRubberBand,
    startInertiaGlide,
    handleDoubleTap,
    handleNext,
    handlePrev,
    onClose,
    hideFloatingControls,
    scheduleFloatingControlsReappear,
  ]);

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
    if (!videoRef.current || !currentItem) return;
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setCurrentTime(current);
    setDuration(dur);
    setVideoProgress((current / dur) * 100);
    if (currentItem.id) {
      videoPlaybackPositionsRef.current[currentItem.id] = current;
    }
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



  if (!isOpen || !currentItem || !mounted) return null;

  const currentMediaUrl = currentItem.secureUrl || currentItem.url;
  const isVideo = currentItem.mediaType === 'VIDEO';

  const prevIndex = (currentIndex - 1 + items.length) % items.length;
  const nextIndex = (currentIndex + 1) % items.length;
  const prevItem = items[prevIndex];
  const nextItem = items[nextIndex];

  const modalContent = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[99999] bg-black flex flex-col select-none overflow-hidden"
      style={{
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100vw',
        maxWidth: '100vw',
        backgroundColor: `rgba(0, 0, 0, ${dismissOffset.opacity})`,
        transition: isInteracting ? 'none' : 'background-color 0.28s ease-out',
      }}
      onMouseMove={() => {
        if (!isVideo) showControlsTemporarily();
      }}
      onMouseUp={handleMouseUp}
    >


      {/* ========================================================================= */}
      {/* 2. DESKTOP TOP FLOATING CONTROL BAR                                       */}
      {/* ========================================================================= */}
      <div
        className={`relative z-30 shrink-0 hidden sm:flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 text-white border-b border-white/10 bg-black/50 backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isUiVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)',
          paddingLeft: 'max(env(safe-area-inset-left, 0px), 24px)',
          paddingRight: 'max(env(safe-area-inset-right, 0px), 24px)',
        }}
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
                disabled={zoom >= MAX_ZOOM}
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
            onClick={() => {
              stopAllVideos();
              onClose();
            }}
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

        {/* Media Canvas with iOS-style Real-Time Slide Engine */}
        <div
          ref={imageContainerRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
          onMouseDown={handleMouseDown}
          onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
          style={{
            cursor: zoom > 1 ? (isInteracting ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {items.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            const isItemVideo = item.mediaType === 'VIDEO';
            const mediaUrl = item.secureUrl || item.url;
            const offsetIndex = idx - currentIndex;

            // Render current, previous (-1), and next (+1) items
            if (Math.abs(offsetIndex) > 1) return null;

            return (
              <div
                key={item.id}
                className="absolute inset-0 flex items-center justify-center will-change-transform select-none"
                style={{
                  transform: `translate3d(calc(${offsetIndex * 100}% + ${offsetIndex * 24}px + ${slideOffset + (isCurrent ? dismissOffset.x : 0)}px), ${isCurrent ? dismissOffset.y : 0}px, 0)`,
                  transition: isInteracting || (isCurrent && isDismissing)
                    ? 'none'
                    : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: isCurrent ? 'auto' : 'none',
                }}
              >
                {isCurrent ? (
                  isItemVideo ? (
                    /* Expansive Full-Stage Video Player Container with Browser's Native Player */
                    <div
                      ref={videoContainerRef}
                      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black select-none"
                      style={{
                        transform: `scale(${dismissOffset.scale})`,
                        borderRadius: dismissOffset.y > 10 ? '24px' : undefined,
                        transition: isInteracting || isDismissing ? (isDismissing ? 'transform 0.22s ease-out' : 'none') : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.2s ease',
                      }}
                    >
                      <video
                        ref={videoRef}
                        src={mediaUrl}
                        controls
                        playsInline
                        autoPlay
                        preload="auto"
                        onLoadedMetadata={() => {
                          if (!videoRef.current || !currentItem) return;
                          const dur = videoRef.current.duration || 1;
                          setDuration(dur);
                          const savedTime = videoPlaybackPositionsRef.current[currentItem.id] || 0;
                          if (savedTime > 0 && savedTime < dur - 0.5) {
                            try {
                              videoRef.current.currentTime = savedTime;
                            } catch {}
                          }
                          const playPromise = videoRef.current.play();
                          if (playPromise !== undefined) {
                            playPromise
                              .then(() => setIsPlaying(true))
                              .catch(() => setIsPlaying(false));
                          }
                        }}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onEnded={() => {
                          setIsPlaying(false);
                          if (currentItem?.id) {
                            videoPlaybackPositionsRef.current[currentItem.id] = 0;
                          }
                        }}
                        style={{
                          transform: videoRotation ? `rotate(${videoRotation}deg)` : undefined,
                          maxWidth: 'calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px)',
                          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)',
                          width: videoRotation % 180 !== 0 ? 'auto' : undefined,
                          height: videoRotation % 180 !== 0 ? 'auto' : undefined,
                          objectFit: 'contain',
                          transition: 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
                        }}
                        className="z-10 select-none m-auto"
                      />
                    </div>
                  ) : (
                    <img
                      ref={imgRef}
                      src={mediaUrl}
                      alt={item.filename || 'Photo'}
                      style={{
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom * dismissOffset.scale}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                        maxWidth: 'calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px)',
                        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)',
                        width: rotation % 180 !== 0 ? 'auto' : undefined,
                        height: rotation % 180 !== 0 ? 'auto' : undefined,
                        objectFit: 'contain',
                        borderRadius: dismissOffset.y > 10 ? '24px' : undefined,
                        transition: isInteracting || isDismissing
                          ? 'none'
                          : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.2s ease',
                      }}
                      draggable={false}
                      className="object-contain z-10 select-none m-auto pointer-events-auto will-change-transform"
                    />
                  )
                ) : isItemVideo ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black/80 pointer-events-none select-none">
                    <div className="w-16 h-16 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-2xl">
                      <Play className="w-8 h-8 fill-white ml-0.5 opacity-80" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={mediaUrl}
                    alt={item.filename || 'Photo'}
                    style={{
                      maxWidth: 'calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px)',
                      maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 32px)',
                      objectFit: 'contain',
                    }}
                    loading="eager"
                    draggable={false}
                    className="object-contain z-10 select-none m-auto pointer-events-none"
                  />
                )}
              </div>
            );
          })}
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

