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
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMove?: (direction: 'left' | 'right') => void;
  onDelete?: (id: string, publicId?: string | null) => void;
  isAdmin?: boolean;
}

export function VoiceNotePlayerCard({
  id,
  url,
  filename,
  createdAt,
  publicId,
  index = 0,
  isEditMode = false,
  canMoveLeft = false,
  canMoveRight = false,
  onMove,
  onDelete,
  isAdmin = false,
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
      className={`p-3.5 sm:p-4 rounded-2xl bg-white border transition-all duration-200 flex flex-col gap-2.5 ${
        isEditMode
          ? 'border-violet-400 ring-2 ring-violet-400/25 shadow-sm'
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
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
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
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600 hover:h-2 transition-all"
        />
      </div>

      {/* Edit Mode Reorder Buttons (Move Left & Move Right) */}
      {isEditMode && onMove && (
        <div className="flex items-center justify-between pt-1 border-t border-violet-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canMoveLeft}
            onClick={() => onMove('left')}
            className="h-7 px-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 text-[11px] font-bold gap-1 disabled:opacity-30 cursor-pointer"
            title="Move earlier in list"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Move Left
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canMoveRight}
            onClick={() => onMove('right')}
            className="h-7 px-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 text-[11px] font-bold gap-1 disabled:opacity-30 cursor-pointer"
            title="Move later in list"
          >
            Move Right <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
