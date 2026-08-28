'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trash2,
  Download,
  Mic,
  Music,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface VoiceNotePlayerCardProps {
  id: string;
  url: string;
  filename?: string | null;
  createdAt?: Date | string;
  publicId?: string | null;
  index?: number;
  isEditMode?: boolean;
  onDelete?: (id: string, publicId?: string | null) => void;
  isAdmin?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  isFloating?: boolean;
  isSourceSlot?: boolean;
  isTargetSlot?: boolean;
  deltaX?: number;
  deltaY?: number;
}

export function VoiceNotePlayerCard({
  id,
  url,
  filename,
  createdAt,
  publicId,
  index = 0,
  isEditMode = false,
  onDelete,
  isAdmin = false,
  onPointerDown,
  isFloating = false,
  isSourceSlot = false,
  isTargetSlot = false,
  deltaX = 0,
  deltaY = 0,
}: VoiceNotePlayerCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  // Format seconds to mm:ss safely (prevents Infinity/NaN on WebM streams)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const cur = audio.currentTime;
    let dur = audio.duration;
    if (!isFinite(dur) || isNaN(dur)) {
      dur = Math.max(cur, duration || 1);
    }

    setCurrentTime(cur);
    setDuration(dur);
    setProgress(dur > 0 ? (cur / dur) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && audio.duration && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const seekPercent = parseFloat(e.target.value);
    const newTime = (seekPercent / 100) * (duration || 1);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(seekPercent);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const dateFormatted = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      onPointerDown={onPointerDown}
      data-reorder-index={index}
      style={{
        transform: isFloating
          ? `translate3d(${deltaX}px, ${deltaY}px, 0) scale(1.04) rotate(1deg)`
          : undefined,
        zIndex: isFloating ? 9999 : isTargetSlot && !isSourceSlot ? 30 : undefined,
        transition: isFloating ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, opacity 0.2s ease',
      }}
      className={`p-3.5 sm:p-4 rounded-2xl bg-white border flex flex-col gap-2.5 select-none ${
        isFloating
          ? 'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-4 ring-violet-500 ring-offset-2 opacity-95 pointer-events-none'
          : isSourceSlot && !isFloating
          ? 'opacity-25 border-dashed border-2 border-violet-500 scale-95'
          : isTargetSlot && !isSourceSlot
          ? 'border-violet-600 ring-4 ring-violet-500/40 bg-violet-50/40 scale-[1.02] shadow-xl'
          : isEditMode
          ? 'border-violet-400 ring-2 ring-violet-400/25 shadow-sm cursor-grab active:cursor-grabbing touch-none'
          : 'border-border/80 shadow-2xs hover:shadow-md'
      }`}
    >
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="flex items-center justify-between gap-3">
        {/* Play Button + Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isEditMode && (
            <div className="text-violet-400 hover:text-violet-600 cursor-grab active:cursor-grabbing shrink-0 pr-0.5">
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          <button
            type="button"
            onClick={togglePlay}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-500/25 shrink-0 transition-all active:scale-95 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play Voice Note'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white text-white" />
            ) : (
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-foreground truncate">
                {filename || 'Voice Note Recording'}
              </p>
              {isEditMode && (
                <Badge className="bg-violet-600 text-white font-extrabold text-[10px] px-1.5 py-0 shadow-sm shrink-0">
                  #{index + 1}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span>{dateFormatted}</span>
              <span>•</span>
              <span className="font-mono text-violet-700 font-semibold">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons (Download or Edit actions) */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={filename || 'voice_note'}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Download Audio"
          >
            <Download className="w-3.5 h-3.5" />
          </a>

          {/* Delete Button (Visible in Edit Mode) */}
          {isEditMode && isAdmin && onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(id, publicId)}
              className="h-7 w-7 p-0 bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
              title="Delete Voice Note"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Timeline Bar */}
      <div className="flex items-center gap-2 pt-0.5">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          onChange={handleSeek}
          className="w-full h-1.5 bg-muted/80 rounded-lg appearance-none cursor-pointer accent-violet-600 hover:h-2 transition-all"
        />
      </div>
    </div>
  );
}
