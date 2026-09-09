'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Trash2,
  Loader2,
  Check,
  Lock,
  ChevronLeft,
  ChevronUp,
  Pause,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadMediaAction } from '@/features/media/actions/media.actions';

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
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // WhatsApp-Style Touch & Gesture States
  const [isLocked, setIsLocked] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [slideDistance, setSlideDistance] = useState(0);
  const [slideUpDistance, setSlideUpDistance] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([5, 8, 14, 20, 15, 9, 6]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Web Audio Analyser for Real-Time Soundwaves
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Pointer tracker for swipe physics
  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    isLocked: boolean;
  } | null>(null);

  // Ref to mic button — used to anchor the recording capsule to the button's position
  const micButtonRef = useRef<HTMLButtonElement>(null);

  // Capsule position: anchored to button via getBoundingClientRect()
  const [capsulePos, setCapsulePos] = useState<{ bottom: number; right: number } | null>(null);

  const captureButtonPosition = () => {
    if (micButtonRef.current) {
      const rect = micButtonRef.current.getBoundingClientRect();
      setCapsulePos({
        // right: distance from viewport right edge to button's right edge
        right: window.innerWidth - rect.right,
        // bottom: distance from viewport bottom to button's top, + small gap
        bottom: window.innerHeight - rect.top + 10,
      });
    }
  };

  // Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Safe Haptic feedback trigger
  const triggerHaptic = useCallback((pattern: number | number[] = 25) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }, []);

  // Body scroll lock while holding (prevents page scroll on mobile)
  const lockBodyScroll = useCallback(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }, []);

  const unlockBodyScroll = useCallback(() => {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }, []);

  // Clean up timer, audio context, and media stream
  const cleanupStream = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

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
    setRecordingDuration(0);
    setIsRecording(false);
    setIsPaused(false);
    setIsLocked(false);
    setIsHolding(false);
    setSlideDistance(0);
    setSlideUpDistance(0);
    setAudioLevels([5, 8, 14, 20, 15, 9, 6]);
    pointerStateRef.current = null;
    unlockBodyScroll();
  }, [unlockBodyScroll]);

  // Global listeners
  useEffect(() => {
    const handleStopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      cleanupStream();
    };

    window.addEventListener('popstate', handleStopRecording);
    window.addEventListener('pagehide', handleStopRecording);
    window.addEventListener('beforeunload', handleStopRecording);
    window.addEventListener('tv-tech-stop-all-recording', handleStopRecording);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleStopRecording();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      handleStopRecording();
      window.removeEventListener('popstate', handleStopRecording);
      window.removeEventListener('pagehide', handleStopRecording);
      window.removeEventListener('beforeunload', handleStopRecording);
      window.removeEventListener('tv-tech-stop-all-recording', handleStopRecording);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cleanupStream]);

  // Real-time audio waveform visualizer
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

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const indices = [1, 3, 5, 8, 11, 14, 18];

      const updateLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const levels = indices.map((i) => {
          const val = dataArray[i] || 0;
          return Math.max(4, Math.min(26, Math.round((val / 255) * 22) + 4));
        });
        setAudioLevels(levels);
        animFrameRef.current = requestAnimationFrame(updateLevels);
      };

      animFrameRef.current = requestAnimationFrame(updateLevels);
    } catch (err) {
      console.warn('Audio analyser error:', err);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (disabled || isUploading) return;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tv-tech-pause-all-audio'));
      window.dispatchEvent(new CustomEvent('tv-tech-stop-all-recording'));
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

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
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      setupAudioAnalyser(stream);
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      toast.error(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow mic permissions in browser settings.'
          : 'Could not access microphone: ' + (err.message || 'Unknown error')
      );
      cleanupStream();
    }
  };

  // Toggle Pause / Resume in Locked Mode
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

  // Stop recording and upload audio
  const stopAndUpload = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupStream();
      return;
    }

    setIsUploading(true);

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (audioBlob.size < 1000 || recordingDuration < 1) {
          toast.error('Voice note too short. Please hold to talk.');
          cleanupStream();
          setIsUploading(false);
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

        try {
          const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
          const json = await response.json();
          if (json.success && json.media) savedMedia = json.media;
        } catch {}

        if (!savedMedia) {
          const actionRes = await uploadMediaAction(formData);
          if (actionRes.success && actionRes.media) {
            savedMedia = actionRes.media;
          } else {
            toast.error(actionRes.error || 'Failed to save voice note');
          }
        }

        if (savedMedia) {
          onRecordingComplete(savedMedia);
          triggerHaptic([30, 60]);
          toast.success(`Voice note saved! (${formatDuration(recordingDuration)})`);
        }
      } catch (err: any) {
        toast.error('Audio upload error: ' + (err.message || 'Network error'));
      } finally {
        cleanupStream();
        setIsUploading(false);
      }
    };

    try {
      recorder.stop();
    } catch {}

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    }
  };

  // Discard recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    triggerHaptic([40, 50, 40]);
    cleanupStream();
    toast.info('Voice recording discarded');
  };

  // ============================================================
  // POINTER HANDLERS
  // ============================================================

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Locked mode: tapping mic = SEND
    if (isLocked && isRecording) {
      triggerHaptic(35);
      stopAndUpload();
      return;
    }

    if (disabled || isUploading || isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pointerStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      isLocked: false,
    };

    triggerHaptic(35);
    setIsHolding(true);
    setIsLocked(false);
    setSlideDistance(0);
    setSlideUpDistance(0);
    captureButtonPosition();
    lockBodyScroll();
    startRecording();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = pointerStateRef.current;
    if (!state || state.isLocked || !isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = state.startX - e.clientX;
    const dy = state.startY - e.clientY;

    setSlideDistance(Math.max(0, dx));
    setSlideUpDistance(Math.max(0, dy));

    // Slide-up to Lock
    if (dy > 45 && !state.isLocked) {
      state.isLocked = true;
      setIsLocked(true);
      setIsHolding(false);
      unlockBodyScroll();
      triggerHaptic([30, 40]);
      toast.info('Recording locked — tap mic to send', { duration: 2000 });
      return;
    }

    // Slide-left to Cancel
    if (dx > 85) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      pointerStateRef.current = null;
      unlockBodyScroll();
      cancelRecording();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = pointerStateRef.current;
    if (!state) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (state.isLocked) {
      pointerStateRef.current = null;
      return;
    }

    const holdDuration = Date.now() - state.startTime;
    const currentDx = state.startX - e.clientX;

    pointerStateRef.current = null;
    setIsHolding(false);
    unlockBodyScroll();

    if (currentDx > 65) {
      cancelRecording();
      return;
    }

    // Quick tap: enter lock mode (re-tap mic = send)
    if (holdDuration < 400) {
      setIsLocked(true);
      triggerHaptic(25);
      toast.info('Locked — tap mic to send', { duration: 2000 });
      return;
    }

    // Long press release: auto send
    triggerHaptic(35);
    stopAndUpload();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = pointerStateRef.current;
    if (!state) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!state.isLocked) cancelRecording();
    pointerStateRef.current = null;
    setIsHolding(false);
    unlockBodyScroll();
  };

  // ============================================================
  // RENDER
  // The mic button ALWAYS stays in-place in the action bar.
  // Recording UI renders as a fixed bottom overlay (no overflow).
  // ============================================================

  return (
    <>
      {/* MIC BUTTON — always visible, always in-place */}
      <div className="relative shrink-0">
        {/* Breathing aura when idle */}
        {!isRecording && !isUploading && (
          <span className="absolute -inset-2 rounded-full bg-violet-500/20 blur-md animate-[pulse_3s_ease-in-out_infinite] pointer-events-none" />
        )}

        {isUploading ? (
          <div className="w-11 h-11 rounded-full bg-violet-950/95 border border-violet-400/40 shadow-xl flex items-center justify-center ring-2 ring-violet-500/30 shrink-0">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          </div>
        ) : (
          <button
            ref={micButtonRef}
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={!isLocked ? handlePointerMove : undefined}
            onPointerUp={!isLocked ? handlePointerUp : undefined}
            onPointerCancel={!isLocked ? handlePointerCancel : undefined}
            disabled={disabled}
            className={`w-11 h-11 rounded-full text-white flex items-center justify-center shadow-md transition-all cursor-pointer border touch-none select-none relative z-10 shrink-0 ${
              isRecording && !isLocked
                ? 'bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 ring-4 ring-violet-500/40 scale-110 shadow-lg shadow-violet-500/50 border-white/30'
                : isRecording && isLocked
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 ring-2 ring-emerald-400/40 border-white/30 hover:scale-105 active:scale-90'
                : 'bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 ring-2 ring-violet-400/25 border-white/30 active:scale-95'
            }`}
            title={
              isLocked
                ? 'Tap to send voice note'
                : 'Press & hold to record • Slide left to cancel • Slide up to lock'
            }
            aria-label={isLocked ? 'Tap to send' : 'Record Voice Note'}
          >
            {isRecording && isLocked ? (
              <Check className="w-5 h-5 stroke-[2.5]" />
            ) : (
              <Mic
                className={`w-5 h-5 text-white transition-transform ${
                  isRecording && !isLocked ? 'animate-pulse' : ''
                }`}
              />
            )}
          </button>
        )}
      </div>

      {/* RECORDING CAPSULE — anchored to mic button position, expands left */}
      {isRecording && capsulePos && (
        <div
          className="fixed z-50 flex flex-col items-end gap-2 pointer-events-none"
          style={{
            bottom: capsulePos.bottom,
            right: Math.max(8, capsulePos.right),
            maxWidth: `min(calc(100vw - ${Math.max(8, capsulePos.right) + 8}px), 360px)`,
          }}
        >
          {/* Slide-up-to-lock pill */}
          {!isLocked && (
            <div
              style={{ transform: `translateY(-${Math.min(slideUpDistance * 0.4, 12)}px)` }}
              className="pointer-events-none animate-in fade-in slide-in-from-bottom-2 select-none transition-transform"
            >
              <div
                className={`px-3 py-1.5 rounded-full text-[11px] font-black shadow-xl border flex items-center gap-1.5 transition-all ${
                  slideUpDistance > 30
                    ? 'bg-emerald-600 text-white border-emerald-400 scale-110 ring-2 ring-emerald-400/40'
                    : 'bg-slate-900/90 text-slate-200 border-slate-700/80 backdrop-blur-md'
                }`}
              >
                <ChevronUp className="w-3 h-3 text-slate-400 animate-bounce" />
                <Lock className="w-3 h-3" />
                <span className="tracking-wide">Slide up to lock</span>
              </div>
            </div>
          )}

          {/* Main recording capsule */}
          <div className="pointer-events-auto" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
            <div
              className={`h-12 rounded-full bg-slate-950/98 dark:bg-black/98 text-white shadow-2xl border border-violet-500/30 backdrop-blur-xl flex items-center select-none touch-none animate-in fade-in zoom-in-95 duration-200 ring-2 ring-violet-500/20 ${
                isLocked ? 'px-2 gap-2' : 'px-3 gap-2.5'
              }`}
            >
              {/* Trash button (locked mode) */}
              {isLocked && (
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-600 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-90"
                  title="Discard recording"
                  aria-label="Discard recording"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Red dot + timer */}
              <div className="flex items-center gap-2 shrink-0">
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
                <span className="font-mono text-sm font-black text-red-100 tracking-wider min-w-[42px]">
                  {formatDuration(recordingDuration)}
                </span>
              </div>

              {/* Soundwave bars */}
              <div className="flex items-center gap-[3px] h-6 px-0.5 shrink-0">
                {audioLevels.map((height, i) => (
                  <span
                    key={i}
                    style={{ height: isPaused ? '4px' : `${height}px` }}
                    className="w-1 bg-gradient-to-t from-violet-500 via-purple-400 to-indigo-300 rounded-full transition-[height] duration-75 ease-out"
                  />
                ))}
              </div>

              {/* Slide-to-cancel (hold mode) OR pause/resume (locked mode) */}
              {!isLocked ? (
                <div
                  style={{
                    transform: `translateX(-${Math.min(slideDistance, 40)}px)`,
                    opacity: Math.max(0.2, 1 - slideDistance / 70),
                  }}
                  className="flex items-center gap-1 text-slate-300 text-[11px] font-semibold select-none transition-transform pointer-events-none pr-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400 animate-[pulse_1s_ease-in-out_infinite]" />
                  <span className={slideDistance > 50 ? 'text-red-400 font-bold' : ''}>
                    {slideDistance > 50 ? 'Release to cancel' : 'Slide to cancel'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={togglePause}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-90"
                  title={isPaused ? 'Resume recording' : 'Pause recording'}
                  aria-label={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? (
                    <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5 fill-white" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uploading overlay — anchored to button position */}
      {isUploading && capsulePos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ bottom: capsulePos.bottom, right: Math.max(8, capsulePos.right) }}
        >
          <div className="h-11 px-4 rounded-full bg-violet-950/95 text-white border border-violet-400/40 shadow-2xl flex items-center gap-2.5 backdrop-blur-xl animate-pulse ring-2 ring-violet-500/30">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400 shrink-0" />
            <span className="text-xs font-bold tracking-tight">Saving voice note...</span>
          </div>
        </div>
      )}
    </>
  );
}
