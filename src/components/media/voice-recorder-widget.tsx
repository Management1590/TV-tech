'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Trash2,
  Send,
  Loader2,
  Check,
  Volume2,
  AlertCircle,
  Sparkles,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VoiceRecorderWidgetProps {
  entityId: string;
  onRecordingComplete: (newMedia: any) => void;
  disabled?: boolean;
}

export function VoiceRecorderWidget({
  entityId,
  onRecordingComplete,
  disabled = false,
}: VoiceRecorderWidgetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isLocked, setIsLocked] = useState(false); // Tap mode vs hold mode

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);

  // Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Clean up timer and media stream
  const cleanupStream = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecordingDuration(0);
    setIsRecording(false);
    setIsLocked(false);
    isHoldingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  // Start recording
  const startRecording = async () => {
    if (disabled || isUploading) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Determine best supported mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      const selectedMimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';

      const recorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // 100ms slices for smooth capture
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      toast.error(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow mic permissions in browser settings.'
          : 'Could not access microphone: ' + err.message
      );
      cleanupStream();
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

        if (audioBlob.size < 1000) {
          toast.error('Voice note too short. Please try again.');
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

        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        const json = await response.json();
        if (json.success && json.media) {
          onRecordingComplete(json.media);
          toast.success(`Voice note saved! (${formatDuration(recordingDuration)})`);
        } else {
          toast.error(json.error || 'Failed to save voice note');
        }
      } catch (err: any) {
        toast.error('Audio upload error: ' + err.message);
      } finally {
        cleanupStream();
        setIsUploading(false);
      }
    };

    recorder.stop();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  };

  // Discard recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupStream();
    toast.info('Voice recording discarded');
  };

  // Pointer / Click Handler -> Start recording cleanly
  const handleStartClick = () => {
    if (isRecording || disabled || isUploading) return;
    startRecording();
  };

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      {!isRecording && !isUploading ? (
        /* ========================================================================= */
        /* IDLE STATE: TAP TO RECORD BUTTON                                          */
        /* ========================================================================= */
        <button
          type="button"
          onClick={handleStartClick}
          disabled={disabled}
          className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2.5 cursor-pointer transition-all shadow-md shadow-violet-500/20 hover:shadow-lg active:scale-95 border border-white/20 select-none group w-full sm:w-auto"
          title="Tap to record voice note"
        >
          <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
          </div>
          <span className="truncate">Record Voice</span>
        </button>
      ) : isUploading ? (
        /* ========================================================================= */
        /* UPLOADING / PROCESSING STATE                                              */
        /* ========================================================================= */
        <div className="h-10 px-4 rounded-2xl bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold flex items-center gap-2.5 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
          <span>Saving voice note to storage...</span>
        </div>
      ) : (
        /* ========================================================================= */
        /* ACTIVE RECORDING STATE (LIVE SOUND WAVES, TIMER & ACTIONS)                 */
        /* ========================================================================= */
        <div className="h-11 px-3 sm:px-4 rounded-2xl bg-violet-950/90 text-white border border-violet-500/40 shadow-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
          {/* Pulsing Red Recording Indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="font-mono text-xs sm:text-sm font-extrabold text-red-200 tracking-wider">
              {formatDuration(recordingDuration)}
            </span>
          </div>

          {/* Animated Frequency Waves */}
          <div className="flex items-center gap-0.5 h-4 px-1">
            <span className="w-1 bg-violet-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3"></span>
            <span className="w-1 bg-violet-300 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-5"></span>
            <span className="w-1 bg-violet-200 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-4"></span>
            <span className="w-1 bg-violet-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-6"></span>
            <span className="w-1 bg-violet-300 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-3"></span>
          </div>

          {/* Action Buttons: Cancel & Done */}
          <div className="flex items-center gap-1.5 ml-1">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-red-500/80 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Discard Recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={stopAndUpload}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Finish & Save Voice Note"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
