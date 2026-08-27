'use client';

import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Film,
  Sparkles,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface MediaUploadProgressModalProps {
  isOpen: boolean;
  totalFiles: number;
  currentFileIndex: number;
  currentFileName: string;
  isComplete?: boolean;
}

export function MediaUploadProgressModal({
  isOpen,
  totalFiles,
  currentFileIndex,
  currentFileName,
  isComplete = false,
}: MediaUploadProgressModalProps) {
  const [activeStep, setActiveStep] = useState(0);

  // Cycle through informative processing steps
  const steps = [
    'Streaming high-resolution data to secure storage...',
    'Optimizing compression and generating media player cache...',
    'Syncing Knowledge Base attachment index...',
  ];

  useEffect(() => {
    if (!isOpen) {
      setActiveStep(0);
      return;
    }

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 2400);

    return () => clearInterval(interval);
  }, [isOpen, steps.length]);

  if (!isOpen) return null;

  const isVideo =
    currentFileName.toLowerCase().endsWith('.mp4') ||
    currentFileName.toLowerCase().endsWith('.mov') ||
    currentFileName.toLowerCase().endsWith('.webm') ||
    currentFileName.toLowerCase().endsWith('.mkv');

  const fileProgressPercent = totalFiles > 0
    ? Math.min(Math.round(((currentFileIndex) / totalFiles) * 100), 100)
    : 10;

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 select-none"
    >
      {/* Background Ambient Glows */}
      <div className="absolute w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -top-20 -left-20 pointer-events-none animate-pulse" />
      <div className="absolute w-96 h-96 bg-purple-600/20 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none animate-pulse" />

      {/* Main Glassmorphic Modal Card */}
      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-700/60 shadow-2xl rounded-3xl p-6 sm:p-8 text-center overflow-hidden">
        {/* Top Shimmer Border Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />

        {/* Animated Upload Orb */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          {/* Outer Pulsating Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-400/40 animate-spin [animation-duration:12s]" />

          {/* Inner Glowing Ring */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-400/50 shadow-lg shadow-blue-500/20 animate-pulse" />

          {/* Icon in Center */}
          <div className="relative z-10 text-white flex items-center justify-center">
            {isComplete ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            ) : isVideo ? (
              <Film className="w-10 h-10 text-purple-300 animate-pulse" />
            ) : (
              <ImageIcon className="w-10 h-10 text-blue-300 animate-pulse" />
            )}
          </div>
        </div>

        {/* Header Title */}
        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
          <span>{isComplete ? 'Upload Complete!' : 'Uploading & Processing Media'}</span>
          {!isComplete && <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />}
        </h3>

        {/* Current File Name */}
        <div className="mt-2.5 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50 inline-block max-w-full">
          <p className="text-xs font-mono font-medium text-slate-300 truncate max-w-[280px] sm:max-w-[320px]">
            {currentFileName || 'Preparing media files...'}
          </p>
        </div>

        {/* File Counter Indicator */}
        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
          <span>
            {totalFiles > 1 ? `File ${currentFileIndex} of ${totalFiles}` : 'Processing media'}
          </span>
          <span className="text-blue-400 font-mono font-bold">{fileProgressPercent}%</span>
        </div>

        {/* Animated Progress Bar */}
        <div className="mt-2 w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 relative">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500 relative"
            style={{ width: `${Math.max(fileProgressPercent, 8)}%` }}
          >
            {/* Shimmer inside progress bar */}
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        </div>

        {/* Live Step Status */}
        <div className="mt-5 min-h-[40px] flex items-center justify-center gap-2 text-xs text-slate-300">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
          <span className="animate-in fade-in duration-300 font-medium">
            {isComplete ? 'All media files synced successfully!' : steps[activeStep]}
          </span>
        </div>

        {/* Security & Quality Badges */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure Cloud Upload</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>HD Quality Retained</span>
          </div>
        </div>
      </div>
    </div>
  );
}
