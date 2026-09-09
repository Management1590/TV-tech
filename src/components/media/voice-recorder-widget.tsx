'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Trash2,
  Loader2,
  Send,
  Lock,
  ChevronLeft,
  ChevronUp,
  Pause,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadMediaAction } from '@/features/media/actions/media.actions';

// ============================================================
// AUDIO VISUALIZER SUBCOMPONENT
// Renders dynamic frequency soundwave equalizer without re-rendering parent
// ============================================================
function AudioVisualizer({
  analyser,
  isPaused,
}: {
  analyser: AnalyserNode | null;
  isPaused: boolean;
}) {
  const [levels, setLevels] = useState<number[]>([6, 12, 18, 24, 16, 10, 6]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const indices = [1, 3, 5, 8, 11, 14, 18];

    const updateLevels = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);
      const newLevels = indices.map((i) => {
        const val = dataArray[i] || 0;
        return Math.max(5, Math.min(26, Math.round((val / 255) * 22) + 5));
      });
      setLevels(newLevels);
      animFrameRef.current = requestAnimationFrame(updateLevels);
    };

    animFrameRef.current = requestAnimationFrame(updateLevels);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [analyser]);

  return (
    <div className="flex items-center gap-[2.5px] h-5 px-0.5 shrink-0 pointer-events-none select-none">
      {levels.map((height, i) => (
        <span
          key={i}
          style={{ height: isPaused ? '4px' : `${height}px` }}
          className="w-0.5 sm:w-1 bg-gradient-to-t from-violet-500 via-purple-400 to-indigo-300 rounded-full transition-[height] duration-75 ease-out"
        />
      ))}
    </div>
  );
}

// ============================================================
// VOICE RECORDER WIDGET PROPS
// ============================================================
interface VoiceRecorderWidgetProps {
  entityId: string;
  onRecordingComplete: (newMedia: any) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function VoiceRecorderWidget({
  entityId,
  onRecordingComplete,
  disabled = false,
  compact = false,
}: VoiceRecorderWidgetProps) {
  // Unique instance ID to prevent killing ourselves on broadcast events
  const instanceIdRef = useRef<string>(`rec_${Math.random().toString(36).slice(2, 9)}`);

  // Lifecycle status: 'idle' | 'starting' | 'recording' | 'uploading'
  const [status, setStatus] = useState<'idle' | 'starting' | 'recording' | 'uploading'>('idle');
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Gesture dragging state
  const [isHolding, setIsHolding] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lockedAtRef = useRef<number>(0);

  // Web Audio Analyser
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyserState, setAnalyserState] = useState<AnalyserNode | null>(null);

  // DOM Button Ref
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const pointerIdRef = useRef<number | null>(null);

  // Gesture tracking refs
  const isDownRef = useRef<boolean>(false);
  const startCoordRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const axisRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const pendingStopRef = useRef<boolean>(false);
  const pendingCancelRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const isLockedRef = useRef<boolean>(false);
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  // Synchronize ref with state
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  // Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Safe Haptic feedback
  const triggerHaptic = useCallback((pattern: number | number[] = 25) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }, []);

  // Body scroll lock/unlock while dragging
  const lockBodyScroll = useCallback(() => {
    try {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } catch {}
  }, []);

  const unlockBodyScroll = useCallback(() => {
    try {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    } catch {}
  }, []);

  // Clean up all streams, timers, and audio contexts
  const cleanupStream = useCallback(() => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAnalyserState(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    startTimeRef.current = 0;
    lockedAtRef.current = 0;
    isDownRef.current = false;
    startCoordRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    axisRef.current = 'none';
    pendingStopRef.current = false;
    pendingCancelRef.current = false;
    isStoppingRef.current = false;
    isLockedRef.current = false;

    if (recordButtonRef.current) {
      recordButtonRef.current.style.transform = 'translate3d(0, 0, 0) scale(1)';
      recordButtonRef.current.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }

    setIsHolding(false);
    setDragOffset({ x: 0, y: 0 });
    setRecordingDuration(0);
    setStatus('idle');
    setIsPaused(false);
    setIsLocked(false);
    unlockBodyScroll();
  }, [unlockBodyScroll]);

  // Global listeners for page transitions and external stop events
  useEffect(() => {
    const handleForceStop = (e: any) => {
      // Ignore if event was dispatched by this exact instance!
      if (e?.detail?.senderId === instanceIdRef.current) return;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      cleanupStream();
    };

    window.addEventListener('popstate', handleForceStop);
    window.addEventListener('pagehide', handleForceStop);
    window.addEventListener('beforeunload', handleForceStop);
    window.addEventListener('tv-tech-stop-all-recording', handleForceStop as EventListener);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleForceStop(null);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      handleForceStop(null);
      window.removeEventListener('popstate', handleForceStop);
      window.removeEventListener('pagehide', handleForceStop);
      window.removeEventListener('beforeunload', handleForceStop);
      window.removeEventListener('tv-tech-stop-all-recording', handleForceStop as EventListener);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [cleanupStream]);

  // Audio Analyser Setup
  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyserRef.current = analyser;
      setAnalyserState(analyser);
    } catch (err) {
      console.warn('Audio analyser error:', err);
    }
  };

  // ============================================================
  // START RECORDING
  // ============================================================
  const startRecording = async () => {
    if (disabled || status === 'uploading') return;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tv-tech-pause-all-audio'));
      // Broadcast stop event identifying ourselves so we do not stop ourselves!
      window.dispatchEvent(
        new CustomEvent('tv-tech-stop-all-recording', {
          detail: { senderId: instanceIdRef.current },
        })
      );
    }

    setStatus('starting');
    startTimeRef.current = Date.now();
    pendingStopRef.current = false;
    pendingCancelRef.current = false;
    isStoppingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      // Check if cancelled while mic permission was being requested
      if (pendingCancelRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        cleanupStream();
        return;
      }

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      const selectedMimeType =
        mimeTypes.find(
          (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
        ) || '';

      const recorder = new MediaRecorder(
        stream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setStatus('recording');
      setIsPaused(false);
      setRecordingDuration(0);

      const startTimestamp = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);

      setupAudioAnalyser(stream);

      // If user released finger while getUserMedia was resolving
      if (pendingStopRef.current) {
        const elapsedNow = Date.now() - startTimeRef.current;
        const delay = Math.max(0, 400 - elapsedNow);
        setTimeout(() => {
          stopAndUpload();
        }, delay);
      }
    } catch (err: any) {
      console.error('Microphone error:', err);
      toast.error(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Could not access microphone: ' + (err.message || 'Unknown error')
      );
      cleanupStream();
    }
  };

  // ============================================================
  // STOP AND UPLOAD RECORDING (SAVE)
  // ============================================================
  const stopAndUpload = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }

    const recorder = mediaRecorderRef.current;

    // If recorder is not ready yet, mark pending
    if (!recorder || recorder.state === 'inactive') {
      if (status === 'starting') {
        pendingStopRef.current = true;
        return;
      }
      cleanupStream();
      return;
    }

    setStatus('uploading');
    unlockBodyScroll();
    setIsHolding(false);
    setDragOffset({ x: 0, y: 0 });

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        const elapsedMs = Date.now() - startTimeRef.current;
        if (audioBlob.size < 200 && elapsedMs < 350) {
          toast.error('Voice note too short.');
          cleanupStream();
          return;
        }

        const extension = recorder.mimeType.includes('mp4')
          ? 'mp4'
          : recorder.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const filename = `Voice Note - ${dateStr}, ${timeStr}.${extension}`;

        const audioFile = new File([audioBlob], filename, {
          type: recorder.mimeType || 'audio/webm',
        });

        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('entityId', entityId);
        formData.append('purpose', 'AUDIO');

        let savedMedia: any = null;

        // Try direct API upload
        try {
          const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
          if (response.ok) {
            const json = await response.json();
            if (json.success && json.media) savedMedia = json.media;
          }
        } catch (fetchErr) {
          console.warn('Direct upload fetch error, trying server action...', fetchErr);
        }

        // Fallback to Server Action
        if (!savedMedia) {
          const actionRes = await uploadMediaAction(formData);
          if (actionRes.success && actionRes.media) {
            savedMedia = actionRes.media;
          } else {
            throw new Error(actionRes.error || 'Upload failed');
          }
        }

        if (savedMedia) {
          onRecordingComplete(savedMedia);
          triggerHaptic([30, 60]);
          toast.success(`Voice note saved! (${formatDuration(recordingDuration || 1)})`);
        }
      } catch (err: any) {
        console.error('Audio upload error:', err);
        toast.error('Failed to save voice note: ' + (err.message || 'Network error'));
      } finally {
        cleanupStream();
      }
    };

    try {
      recorder.requestData();
      recorder.stop();
    } catch {
      cleanupStream();
    }
  };

  // ============================================================
  // CANCEL / DISCARD RECORDING
  // ============================================================
  const cancelRecording = () => {
    pendingCancelRef.current = true;
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    triggerHaptic([40, 50, 40]);
    cleanupStream();
    toast.info('Voice recording discarded');
  };

  // Toggle Pause / Resume (Locked Mode)
  const togglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      recorder.pause();
      setIsPaused(true);
      triggerHaptic(20);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    } else if (recorder.state === 'paused') {
      recorder.resume();
      setIsPaused(false);
      triggerHaptic(20);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  // Switch to Hands-Free Lock mode (Case 2: Tap OR Slide-up release)
  const lockToHandsFree = () => {
    isLockedRef.current = true;
    setIsLocked(true);
    isDownRef.current = false;
    setIsHolding(false);
    setDragOffset({ x: 0, y: 0 });
    dragOffsetRef.current = { x: 0, y: 0 };
    axisRef.current = 'none';
    lockedAtRef.current = Date.now();
    unlockBodyScroll();
    if (recordButtonRef.current) {
      recordButtonRef.current.style.transform = 'translate3d(0, 0, 0) scale(1)';
      recordButtonRef.current.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
    triggerHaptic([30, 45]);
    toast.info('Hands-free mode — click Send when ready', { duration: 2500 });
  };

  // ============================================================
  // PHYSICAL BUTTON GESTURE & ORTHOGONAL SLIDE ENGINE
  // - Directional Axis Lock: sideways slide cannot go up; upward slide cannot go sideways!
  // - Smooth, seamless 60/120fps direct hardware transform
  // - Discard only upon release at the bin icon (no auto-cancel mid-slide)
  // - Flawless on both Mobile (touch) and Desktop Window View (mouse)
  // ============================================================
  const startPhysicalGestureTracking = (clientX: number, clientY: number) => {
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
    }

    const startX = clientX;
    const startY = clientY;
    const startTime = Date.now();

    isDownRef.current = true;
    startCoordRef.current = { x: startX, y: startY, time: startTime };
    setIsHolding(true);
    setDragOffset({ x: 0, y: 0 });
    dragOffsetRef.current = { x: 0, y: 0 };
    axisRef.current = 'none';

    if (recordButtonRef.current) {
      recordButtonRef.current.style.transform = 'translate3d(0, 0, 0) scale(1.26)';
      recordButtonRef.current.style.transition = 'transform 0.15s ease-out';
    }

    const onMove = (currX: number, currY: number) => {
      if (!isDownRef.current || isLockedRef.current) return;

      const rawDx = startX - currX;
      const rawDy = startY - currY;

      // Determine and lock axis once movement exceeds a deadzone of 7px
      if (axisRef.current === 'none') {
        if (rawDx > 7 && rawDx >= rawDy) {
          axisRef.current = 'horizontal';
        } else if (rawDy > 7 && rawDy > rawDx) {
          axisRef.current = 'vertical';
        }
      }

      let dx = 0;
      let dy = 0;

      if (axisRef.current === 'horizontal') {
        // Sliding sideways: Strictly horizontal! Cannot move upward (dy = 0)
        // Allows sliding all the way to the bin icon (up to 210px)
        dx = Math.max(0, Math.min(rawDx, 210));
        dy = 0;
      } else if (axisRef.current === 'vertical') {
        // Sliding upward: Strictly vertical! Cannot move sideways (dx = 0)
        dx = 0;
        dy = Math.max(0, Math.min(rawDy, 55));
      }

      dragOffsetRef.current = { x: dx, y: dy };
      setDragOffset({ x: dx, y: dy });

      // Direct DOM update for instant zero-lag hardware-accelerated movement
      if (recordButtonRef.current) {
        recordButtonRef.current.style.transform = `translate3d(-${dx}px, -${dy}px, 0) scale(1.26)`;
        recordButtonRef.current.style.transition = 'none';
      }
    };

    const onEnd = (endX: number, endY: number) => {
      cleanup();

      if (!isDownRef.current) return;
      isDownRef.current = false;
      unlockBodyScroll();

      if (isLockedRef.current) return;

      const currentAxis = axisRef.current;
      const currentOffset = dragOffsetRef.current;
      const holdDuration = Date.now() - startTime;

      setIsHolding(false);
      setDragOffset({ x: 0, y: 0 });
      dragOffsetRef.current = { x: 0, y: 0 };
      axisRef.current = 'none';

      if (recordButtonRef.current) {
        recordButtonRef.current.style.transform = 'translate3d(0, 0, 0) scale(1)';
        recordButtonRef.current.style.transition =
          'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
      }

      // 1. User slid sideways to the bin icon and released -> DISCARD!
      if (currentAxis === 'horizontal' && currentOffset.x >= 120) {
        cancelRecording();
        return;
      }

      // 2. User slid upward to the lock badge and released -> LOCK HANDS-FREE!
      if (currentAxis === 'vertical' && currentOffset.y >= 32) {
        lockToHandsFree();
        return;
      }

      // 3. Quick Tap (< 280ms) without deliberate slide -> Case 2: Tap to record & send!
      if (holdDuration < 280 && currentOffset.x < 15 && currentOffset.y < 15) {
        lockToHandsFree();
        return;
      }

      // 4. Held and released (or returned to center) -> Case 1: Save & upload!
      triggerHaptic(35);
      stopAndUpload();
    };

    // Robust document & window listeners (Capture phase guarantees events on both Desktop & Mobile)
    const handleDocPointerMove = (e: PointerEvent) => {
      onMove(e.clientX, e.clientY);
    };
    const handleDocPointerUp = (e: PointerEvent) => {
      onEnd(e.clientX, e.clientY);
    };
    const handleDocPointerCancel = (e: PointerEvent) => {
      onEnd(e.clientX, e.clientY);
    };

    const handleDocMouseMove = (e: MouseEvent) => {
      onMove(e.clientX, e.clientY);
    };
    const handleDocMouseUp = (e: MouseEvent) => {
      onEnd(e.clientX, e.clientY);
    };

    const handleDocTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        if (!isLockedRef.current && isDownRef.current) {
          try {
            e.preventDefault(); // Prevent mobile screen scrolling while sliding
          } catch {}
        }
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleDocTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : startX;
      const endY = e.changedTouches.length > 0 ? e.changedTouches[0].clientY : startY;
      onEnd(endX, endY);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handleDocPointerMove, { capture: true });
      window.removeEventListener('pointerup', handleDocPointerUp, { capture: true });
      window.removeEventListener('pointercancel', handleDocPointerCancel, { capture: true });
      window.removeEventListener('mousemove', handleDocMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleDocMouseUp, { capture: true });
      window.removeEventListener('touchmove', handleDocTouchMove, { capture: true });
      window.removeEventListener('touchend', handleDocTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', handleDocTouchEnd, { capture: true });

      try {
        if (recordButtonRef.current && pointerIdRef.current !== null) {
          recordButtonRef.current.releasePointerCapture(pointerIdRef.current);
        }
      } catch {}
      pointerIdRef.current = null;
      cleanupListenersRef.current = null;
    };

    cleanupListenersRef.current = cleanup;

    // Use capture: true on window so drag is never intercepted or swallowed on desktop or mobile
    window.addEventListener('pointermove', handleDocPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', handleDocPointerUp, { capture: true, passive: false });
    window.addEventListener('pointercancel', handleDocPointerCancel, { capture: true, passive: false });
    window.addEventListener('mousemove', handleDocMouseMove, { capture: true, passive: false });
    window.addEventListener('mouseup', handleDocMouseUp, { capture: true, passive: false });
    window.addEventListener('touchmove', handleDocTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', handleDocTouchEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', handleDocTouchEnd, { capture: true, passive: false });
  };

  // Button Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // If in locked mode: clicking Send button saves recording!
    if (isLockedRef.current && (status === 'recording' || status === 'starting')) {
      if (Date.now() - lockedAtRef.current < 300) return;
      e.preventDefault();
      e.stopPropagation();
      triggerHaptic(35);
      stopAndUpload();
      return;
    }

    if (disabled || status === 'uploading' || status === 'recording' || status === 'starting') {
      return;
    }

    // Only respond to primary button (left click = 0 or touch)
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    triggerHaptic(30);
    setIsLocked(false);
    isLockedRef.current = false;
    lockBodyScroll();
    startPhysicalGestureTracking(e.clientX, e.clientY);
    startRecording();
  };

  // Button Click Handler (Fallback)
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || status === 'uploading') return;

    if (isLockedRef.current && (status === 'recording' || status === 'starting')) {
      if (Date.now() - lockedAtRef.current < 300) return;
      triggerHaptic(35);
      stopAndUpload();
      return;
    }

    if (status === 'idle') {
      triggerHaptic(30);
      lockToHandsFree();
      startRecording();
    }
  };

  const isRecordingState = status === 'recording' || status === 'starting';

  // ============================================================
  // RENDER: EMBEDDED INLINE WIDGET
  // ============================================================
  return (
    <div className="relative flex items-center justify-end select-none">
      {/* ------------------------------------------------------------ */}
      {/* 1. SLIDE-UP LOCK TARGET: Directly above mic button            */}
      {/* As the user slides UP, the mic button moves towards this badge*/}
      {/* ------------------------------------------------------------ */}
      {isRecordingState && !isLocked && (
        <div
          onClick={lockToHandsFree}
          style={{
            transform: `translateY(-${Math.min(dragOffset.y * 0.35, 12)}px)`,
          }}
          className="absolute right-1 -top-14 z-20 flex flex-col items-center select-none cursor-pointer transition-transform"
          title="Slide up or click to lock hands-free"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-lg transition-all active:scale-95 ${
              dragOffset.y >= 32
                ? 'bg-violet-600 text-white scale-125 ring-4 ring-violet-400/50 border-violet-300 shadow-violet-500/50'
                : 'bg-slate-950/90 text-slate-200 border-violet-500/30 hover:bg-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
          </div>
          <ChevronUp className="w-3 h-3 text-violet-400 animate-bounce mt-0.5" />
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 2. EMBEDDED RECORDING CAPSULE                                */}
      {/* Expands leftwards smoothly directly from the mic button      */}
      {/* ------------------------------------------------------------ */}
      {isRecordingState && (
        <div
          className="absolute right-0 flex items-center h-11 sm:h-12 bg-slate-950/98 dark:bg-black/98 text-white border border-violet-500/40 rounded-full shadow-2xl shadow-violet-950/30 backdrop-blur-xl px-2.5 sm:px-3 gap-2 sm:gap-2.5 origin-right animate-in fade-in zoom-in-95 duration-200 z-20 ring-1 ring-violet-400/20"
          style={{
            maxWidth: 'min(calc(100vw - 3.5rem), 360px)',
            width: isLocked ? 'auto' : 'max-content',
          }}
        >
          {/* SEPARATE DISCARD BUTTON (Always available in both Case 1 and Case 2) */}
          <button
            type="button"
            onClick={cancelRecording}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
              dragOffset.x >= 120
                ? 'bg-red-600 text-white scale-125 shadow-xl shadow-red-600/60 ring-4 ring-red-400/60 animate-pulse'
                : 'bg-white/10 hover:bg-red-600 text-white/80 hover:text-white'
            }`}
            title="Discard recording"
            aria-label="Discard recording"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Red pulsing live recording indicator + timer */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pointer-events-none select-none">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${
                  isPaused ? 'hidden' : ''
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isPaused ? 'bg-amber-400' : 'bg-red-500'
                }`}
              />
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-red-100 tracking-wider min-w-[38px]">
              {formatDuration(recordingDuration)}
            </span>
          </div>

          {/* Real-time soundwave equalizer bars */}
          <AudioVisualizer analyser={analyserState} isPaused={isPaused} />

          {/* Slide-to-cancel gesture track (Case 1: Holding Mode) */}
          {!isLocked ? (
            <div
              style={{
                opacity: Math.max(0.15, 1 - dragOffset.x / 140),
              }}
              className="flex items-center gap-1 text-slate-300 text-[10px] sm:text-[11px] font-semibold select-none transition-opacity pointer-events-none pr-12"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400 animate-[pulse_1s_ease-in-out_infinite]" />
              <span className={dragOffset.x >= 120 ? 'text-red-400 font-bold animate-pulse' : ''}>
                {dragOffset.x >= 120 ? 'Release to discard' : 'Slide to cancel'}
              </span>
            </div>
          ) : (
            /* Case 2: Tapping Mode (Pause / Resume controls) */
            <div className="flex items-center gap-1.5 pr-12">
              <button
                type="button"
                onClick={togglePause}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-90"
                title={isPaused ? 'Resume' : 'Pause'}
                aria-label={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5 fill-white" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 3. UPLOADING STATE (EMBEDDED)                                 */}
      {/* ------------------------------------------------------------ */}
      {status === 'uploading' && (
        <div className="absolute right-0 flex items-center h-11 sm:h-12 px-4 rounded-full bg-violet-950/98 text-white border border-violet-400/50 shadow-2xl gap-2 backdrop-blur-xl z-20 animate-in fade-in zoom-in-95 duration-200 ring-2 ring-violet-500/40">
          <Loader2 className="w-4 h-4 animate-spin text-violet-300 shrink-0" />
          <span className="text-xs font-bold tracking-tight text-violet-100 whitespace-nowrap">
            Uploading note...
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 4. THE RECORDER / SEND BUTTON                                 */}
      {/* - Holding: BECOMES BIGGER (scale-126) and SLIDES along axis!   */}
      {/* - Tapping: CHANGES TO SEND BUTTON (Paper Airplane)            */}
      {/* - SAME EXACT COLOR AS RECORDER BUTTON (Violet Gradient)!      */}
      {/* ------------------------------------------------------------ */}
      <div className="relative shrink-0 z-30">
        {/* Subtle breathing aura when idle */}
        {status === 'idle' && (
          <span className="absolute -inset-1.5 rounded-full bg-violet-500/25 blur-sm animate-[pulse_3s_ease-in-out_infinite] pointer-events-none" />
        )}

        <button
          ref={recordButtonRef}
          type="button"
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault();
            return false;
          }}
          onMouseDown={(e) => {
            // Prevent desktop text selection and native drag
            e.preventDefault();
          }}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          disabled={disabled || status === 'uploading'}
          style={{
            transform: isHolding
              ? `translate3d(-${dragOffset.x}px, -${dragOffset.y}px, 0) scale(1.26)`
              : 'translate3d(0, 0, 0) scale(1)',
            transition: isHolding
              ? 'none'
              : 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
          }}
          className={`w-11 h-11 rounded-full text-white flex items-center justify-center cursor-pointer border touch-none select-none relative shrink-0 ${
            status === 'uploading'
              ? 'bg-violet-950 border-violet-500/50 opacity-0 pointer-events-none'
              : isLocked
              ? /* CASE 2: SEND BUTTON — SAME VIOLET GRADIENT COLOR AS RECORDER BUTTON! */
                'bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 ring-4 ring-violet-400/50 border-white/40 shadow-xl shadow-violet-500/60 active:scale-90 animate-in zoom-in-95 duration-150'
              : isRecordingState
              ? 'bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 ring-4 ring-violet-400/60 shadow-2xl shadow-violet-500/70 border-white/50'
              : 'bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 ring-2 ring-violet-400/30 border-white/30 active:scale-95 shadow-md'
          }`}
          title={
            isLocked
              ? 'Click Send button to save recording'
              : 'Hold & slide to cancel/lock • Tap for hands-free Send'
          }
          aria-label={isLocked ? 'Send and save voice note' : 'Record voice note'}
        >
          {isLocked ? (
            <Send className="w-5 h-5 text-white fill-white ml-0.5 transition-transform scale-105 pointer-events-none select-none" />
          ) : (
            <Mic
              className={`w-5 h-5 text-white transition-transform pointer-events-none select-none ${
                isRecordingState ? 'animate-pulse scale-110' : ''
              }`}
            />
          )}
        </button>
      </div>
    </div>
  );
}
