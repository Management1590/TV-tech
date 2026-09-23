'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Sparkles,
  MousePointerClick,
  X,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadMediaWithProgress } from '@/lib/media-upload-client';
import { detectMediaKind } from '@/lib/media-detect';

export interface SelectedFileItem {
  id: string;
  file: File;
  previewUrl: string | null;
  isVideo: boolean;
  sizeFormatted: string;
  status: 'idle' | 'preparing' | 'compressing' | 'uploading' | 'registering' | 'completed' | 'error';
  progress: number;
  subtitle: string;
  loadedFormatted?: string;
  totalFormatted?: string;
  error?: string;
}

interface UploadKbMediaDialogProps {
  entityId: string;
  folderName: string;
  modelName: string;
  isOpen: boolean;
  onClose: () => void;
  onMediaUploaded: (newMedia: any) => void;
}

export function UploadKbMediaDialog({
  entityId,
  folderName,
  isOpen,
  onClose,
  onMediaUploaded,
}: UploadKbMediaDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
      setIsUploading(false);
      setIsDragging(false);
      setCurrentFileIndex(0);
      setOverallProgress(0);
    }
  }, [isOpen]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB Cloudinary limit
  const MAX_PHOTO_SIZE_BYTES = 9 * 1024 * 1024;   // 9MB Photo limit

  const handleAddFiles = (files: FileList | File[]) => {
    const newItems: SelectedFileItem[] = [];

    Array.from(files).forEach((file) => {
      const { isImage, isVideo } = detectMediaKind(file.name, file.type);

      if (!isImage && !isVideo) {
        toast.error(`"${file.name}" is not a recognized image or video format`);
        return;
      }

      let previewUrl: string | null = null;
      if (isImage) {
        previewUrl = URL.createObjectURL(file);
      }

      const sizeFormatted = formatFileSize(file.size);
      const isOversizedVideo = isVideo && file.size > MAX_VIDEO_SIZE_BYTES;
      const isOversizedPhoto = isImage && file.size > MAX_PHOTO_SIZE_BYTES;
      const isOversized = isOversizedVideo || isOversizedPhoto;

      if (isOversizedVideo) {
        toast.error(
          `"${file.name}" (${sizeFormatted}) exceeds Cloudinary's 100MB limit. Upload is disabled for files over 100MB.`
        );
      } else if (isOversizedPhoto) {
        toast.error(
          `"${file.name}" (${sizeFormatted}) exceeds the 9MB photo limit. Upload is disabled for photos over 9MB.`
        );
      }

      const errorMsg = isOversizedVideo
        ? `File size too large (${sizeFormatted}). Maximum video size is 100MB.`
        : isOversizedPhoto
        ? `Photo size too large (${sizeFormatted}). Maximum photo size is 9MB.`
        : undefined;

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl,
        isVideo,
        sizeFormatted,
        status: isOversized ? 'error' : 'idle',
        progress: isOversized ? 100 : 0,
        subtitle: errorMsg || sizeFormatted,
        totalFormatted: sizeFormatted,
        error: errorMsg,
      });
    });

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleClearAll = () => {
    selectedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setSelectedFiles([]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one photo or video to upload');
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    const total = selectedFiles.length;
    const fileWeight = 100 / total;

    try {
      for (let i = 0; i < total; i++) {
        const item = selectedFiles[i];

        // Skip files that were already completed on previous run
        if (item.status === 'completed') {
          successCount++;
          continue;
        }

        setCurrentFileIndex(i);

        // Mark active item as starting
        setSelectedFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'compressing',
                  progress: 5,
                  subtitle: f.isVideo ? 'Analyzing video & bitrate...' : 'Analyzing photo...',
                }
              : f
          )
        );

        const uploadResult = await uploadMediaWithProgress(
          item.file,
          entityId,
          'GALLERY',
          (filePct, _statusText, details) => {
            const currentOverall = Math.round(i * fileWeight + (filePct * fileWeight) / 100);
            setOverallProgress(Math.min(99, Math.max(5, currentOverall)));

            setSelectedFiles((prev) =>
              prev.map((f, idx) => {
                if (idx !== i) return f;

                const stage = details?.stage || (filePct >= 100 ? 'completed' : 'uploading');
                let subtitle = f.subtitle;

                if (stage === 'completed' || filePct >= 100) {
                  subtitle = `${f.sizeFormatted} - Done`;
                } else if (stage === 'uploading') {
                  if (details?.formattedLoaded && details?.formattedTotal) {
                    subtitle = `${details.formattedLoaded} / ${details.formattedTotal}`;
                  } else {
                    subtitle = `${formatFileSize((f.file.size * filePct) / 100)} / ${f.sizeFormatted}`;
                  }
                } else if (stage === 'compressing') {
                  subtitle =
                    details?.statusText ||
                    (f.isVideo
                      ? 'Compressing video (WhatsApp HD)...'
                      : 'Compressing photo (WhatsApp HD)...');
                } else if (stage === 'registering') {
                  subtitle = 'Saving to database...';
                } else if (details?.statusText) {
                  subtitle = details.statusText;
                }

                return {
                  ...f,
                  status: stage,
                  progress: filePct,
                  subtitle,
                  loadedFormatted: details?.formattedLoaded,
                  totalFormatted: details?.formattedTotal || f.sizeFormatted,
                };
              })
            );
          }
        );

        if (uploadResult.success && uploadResult.media) {
          onMediaUploaded(uploadResult.media);
          successCount++;
          setSelectedFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: 'completed',
                    progress: 100,
                    subtitle: `${f.sizeFormatted} - Done`,
                  }
                : f
            )
          );
        } else {
          const errMsg = uploadResult.error || `Failed to upload ${item.file.name}`;
          setSelectedFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: 'error',
                    progress: 100,
                    subtitle: errMsg,
                    error: errMsg,
                  }
                : f
            )
          );
        }
      }

      setOverallProgress(100);

      if (successCount === total) {
        toast.success(
          successCount === 1
            ? 'Media uploaded successfully!'
            : `Successfully uploaded all ${successCount} media files!`
        );
        // Brief pause so the user sees all green checkmarks at 100% Done
        await new Promise((r) => setTimeout(r, 650));
        onClose();
      } else if (successCount > 0) {
        toast.info(`Uploaded ${successCount} of ${total} files. Please retry failed files.`);
      } else {
        toast.error('Upload failed. Please check your connection and try again.');
      }
    } catch (err: any) {
      toast.error('Upload error: ' + (err.message || String(err)));
    } finally {
      setIsUploading(false);
    }
  };

  const completedCount = selectedFiles.filter((f) => f.status === 'completed').length;
  const failedCount = selectedFiles.filter((f) => f.status === 'error').length;
  const hasErrors = failedCount > 0;
  const hasOversizedVideo = selectedFiles.some(
    (f) => f.isVideo && f.file.size > MAX_VIDEO_SIZE_BYTES
  );
  const hasOversizedPhoto = selectedFiles.some(
    (f) => !f.isVideo && f.file.size > MAX_PHOTO_SIZE_BYTES
  );
  const hasOversizedMedia = hasOversizedVideo || hasOversizedPhoto;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Soft Blurred Backdrop Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] will-change-opacity cursor-pointer touch-none"
            onClick={() => {
              if (!isUploading) onClose();
            }}
          />

          {/* iOS Style Bottom Sheet Container */}
          <div
            className="fixed inset-x-0 bottom-0 z-[111] flex flex-col justify-end items-center select-none pointer-events-none"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isUploading) {
                onClose();
              }
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{
                y: '100%',
                transition: {
                  duration: 0.22,
                  ease: [0.32, 0, 0.67, 0],
                },
              }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 340,
                mass: 0.8,
              }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.2 }}
              onDragEnd={(_, info) => {
                if ((info.offset.y > 80 || info.velocity.y > 320) && !isUploading) {
                  onClose();
                }
              }}
              className="pointer-events-auto w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-x border-border/80 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden will-change-transform transform-gpu select-text"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
              >
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
              </div>

              {/* Minimal Header */}
              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (target?.closest('button') || target?.closest('a') || target?.closest('input')) return;
                  dragControls.start(e);
                }}
                className="px-5 sm:px-6 pt-0.5 pb-3 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/25 shrink-0">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight truncate">
                      Upload Media Files
                    </h2>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      Add photos and videos to <span className="font-bold text-foreground/90">{folderName}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isUploading}
                  className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Content */}
              <div className="space-y-4 px-5 sm:px-6 py-4 w-full max-w-full overflow-y-auto no-scrollbar flex-1">
                {/* Unified Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {/* State A: Minimalistic, High-End Drop & Touch Zone */}
                {selectedFiles.length === 0 && (
                  <div
                    role="button"
                    tabIndex={0}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`relative w-full rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4 box-border overflow-hidden group select-none ${
                      isDragging
                        ? 'border-2 border-dashed border-violet-500 bg-violet-500/10 scale-[0.99] shadow-lg shadow-violet-500/20'
                        : 'border-2 border-dashed border-violet-400/40 dark:border-violet-500/30 hover:border-violet-600 dark:hover:border-violet-400 bg-gradient-to-b from-violet-500/[0.05] via-purple-500/[0.02] to-transparent hover:from-violet-500/[0.09] shadow-xs hover:shadow-xl hover:shadow-violet-500/10 active:scale-[0.985]'
                    }`}
                  >
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-radial from-violet-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    {/* Click SVG Centerpiece */}
                    <div className="relative mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-violet-500/15 via-purple-500/10 to-indigo-500/15 border border-violet-500/25 flex items-center justify-center text-violet-600 shadow-sm group-hover:scale-108 transition-all duration-300">
                      <MousePointerClick className="w-7 h-7 sm:w-8 sm:h-8 text-violet-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-sm">
                        <Plus className="w-3 h-3 stroke-[3]" />
                      </span>
                    </div>

                    {/* Minimalist Heading & Subtitle */}
                    <div className="space-y-1 text-center max-w-sm">
                      <p className="text-base sm:text-lg font-black text-foreground tracking-tight">
                        Tap anywhere or drag & drop files
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports high-resolution photos & video clips
                      </p>
                    </div>

                    {/* HIGHLIGHTED CHOOSE FILES BUTTON */}
                    <div className="pt-1">
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="h-11 sm:h-12 px-7 sm:px-9 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-violet-500/35 hover:shadow-xl hover:shadow-violet-500/50 active:scale-95 transition-all gap-2.5 cursor-pointer border-0 ring-4 ring-violet-500/15 hover:ring-violet-500/30"
                      >
                        <MousePointerClick className="w-4 h-4 text-violet-100" />
                        <span>Choose Files</span>
                      </Button>
                    </div>

                    {/* Quality Assurance Tag */}
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 pt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <span>WhatsApp HD Quality • Auto-Optimized</span>
                    </div>
                  </div>
                )}

                {/* State B: Files Selected — Sleek Vertical Cards List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3 w-full">
                    {/* Header with Title, Count, Add More & Clear */}
                    <div className="flex items-center justify-between text-xs font-bold text-foreground/90 px-1 select-none">
                      <span className="flex items-center gap-2">
                        <span>Selected Media</span>
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-[11px]">
                          {selectedFiles.length}
                        </span>
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add more</span>
                        </button>
                        {!isUploading && (
                          <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline cursor-pointer"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional Macro Progress Bar during multi-file uploads */}
                    {isUploading && selectedFiles.length > 1 && (
                      <div className="px-3.5 py-2.5 rounded-2xl bg-violet-500/5 dark:bg-violet-950/30 border border-violet-500/20 flex items-center justify-between text-xs animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse shrink-0" />
                          <span className="font-semibold text-foreground truncate">
                            Uploading file {Math.min(selectedFiles.length, currentFileIndex + 1)} of{' '}
                            {selectedFiles.length}...
                          </span>
                        </div>
                        <span className="font-mono font-extrabold text-violet-700 dark:text-violet-300 shrink-0">
                          {overallProgress}% Total
                        </span>
                      </div>
                    )}

                    {/* Stacked File Cards List — Exact match to Reference Screenshot */}
                    <div className="flex flex-col gap-2.5 w-full max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                      {selectedFiles.map((item) => {
                        const isDone = item.status === 'completed';
                        const isError = item.status === 'error';
                        const isInProgress =
                          item.status === 'uploading' ||
                          item.status === 'compressing' ||
                          item.status === 'registering' ||
                          item.status === 'preparing';

                        return (
                          <div
                            key={item.id}
                            className={`border rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 sm:gap-4 transition-all duration-200 group relative w-full overflow-hidden ${
                              isDone
                                ? 'bg-white dark:bg-slate-900 border-emerald-500/30 dark:border-emerald-500/25 shadow-xs'
                                : isError
                                ? 'bg-red-500/[0.03] dark:bg-red-950/20 border-red-500/30'
                                : isInProgress
                                ? 'bg-white dark:bg-slate-900 border-blue-500/30 dark:border-blue-500/30 shadow-sm ring-1 ring-blue-500/15'
                                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                            }`}
                          >
                            {/* Left: App/Media Squircle Icon or Image Thumbnail */}
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shadow-2xs">
                              {item.previewUrl ? (
                                <img
                                  src={item.previewUrl}
                                  alt={item.file.name}
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : item.isVideo ? (
                                <div className="w-full h-full rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                                  <Film className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                              ) : (
                                <div className="w-full h-full rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                              )}
                            </div>

                            {/* Center: File Name, Subtitle, and Inline Linear Progress Bar */}
                            <div className="flex-1 min-w-0 pr-1">
                              {/* Line 1: File Name */}
                              <p
                                className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate select-none leading-tight"
                                title={item.file.name}
                              >
                                {item.file.name}
                              </p>

                              {/* Line 2: Subtitle */}
                              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] sm:text-xs">
                                {isDone ? (
                                  <>
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                                      {item.sizeFormatted}
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">-</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                      Done
                                    </span>
                                  </>
                                ) : item.status === 'uploading' ? (
                                  <span className="text-slate-500 dark:text-slate-400 font-mono font-medium">
                                    {item.loadedFormatted || '0 B'} /{' '}
                                    {item.totalFormatted || item.sizeFormatted}
                                  </span>
                                ) : item.status === 'compressing' ? (
                                  <span className="text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1 truncate">
                                    <Sparkles className="w-3 h-3 text-violet-500 animate-pulse shrink-0" />
                                    <span className="truncate">
                                      {item.subtitle || 'Compressing (WhatsApp HD)...'}
                                    </span>
                                  </span>
                                ) : item.status === 'preparing' ? (
                                  <span className="text-violet-600 dark:text-violet-400 font-medium truncate">
                                    {item.subtitle || 'Preparing file...'}
                                  </span>
                                ) : item.status === 'registering' ? (
                                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                    Saving to cloud database...
                                  </span>
                                ) : isError ? (
                                  <span
                                    className="text-rose-600 dark:text-rose-400 font-medium truncate"
                                    title={item.error || item.subtitle}
                                  >
                                    {item.error || item.subtitle || 'Upload failed'}
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                                      {item.sizeFormatted}
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 font-semibold">
                                      {item.isVideo ? 'WhatsApp HD Video' : 'WhatsApp HD Photo'}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Line 3: Linear Progress Bar Directly Below Subtitle */}
                              <div className="relative w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                                    isDone
                                      ? 'bg-emerald-500'
                                      : item.status === 'uploading'
                                      ? 'bg-blue-600 dark:bg-blue-500'
                                      : item.status === 'compressing' || item.status === 'preparing'
                                      ? 'bg-gradient-to-r from-violet-500 to-indigo-600'
                                      : item.status === 'registering'
                                      ? 'bg-indigo-600'
                                      : isError
                                      ? 'bg-rose-500'
                                      : 'bg-transparent'
                                  }`}
                                  style={{
                                    width:
                                      isDone || isError
                                        ? '100%'
                                        : item.status === 'idle'
                                        ? '0%'
                                        : `${Math.max(4, item.progress)}%`,
                                  }}
                                />
                              </div>
                            </div>

                            {/* Right: Percentage, Circular Status Indicator, and Close/Remove '×' Button */}
                            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 select-none">
                              {/* Percentage Text */}
                              <span
                                className={`text-xs sm:text-sm font-semibold font-mono w-10 sm:w-11 text-right tabular-nums ${
                                  isDone
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isError
                                    ? 'text-rose-600'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {isDone ? '100%' : item.status === 'idle' ? '0%' : `${item.progress}%`}
                              </span>

                              {/* Circular Status Icon */}
                              {isDone ? (
                                /* Green Circle with White Checkmark (matches row 1 in screenshot) */
                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              ) : isError ? (
                                /* Red Circle with Exclamation */
                                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                                  <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                              ) : isInProgress ? (
                                /* Circular Spinner Ring with Open Arc (matches rows 2 & 3 in screenshot) */
                                <svg
                                  className={`w-5 h-5 animate-spin shrink-0 ${
                                    item.status === 'compressing'
                                      ? 'text-violet-600 dark:text-violet-400'
                                      : 'text-blue-600 dark:text-blue-400'
                                  }`}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="9.5"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  />
                                  <path
                                    className="opacity-90"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                              ) : (
                                /* Idle state: subtle ring */
                                <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0" />
                              )}

                              {/* Close / Remove '×' Button (matches screenshot far right) */}
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(item.id)}
                                disabled={isUploading && isInProgress}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                                title="Remove file"
                                aria-label="Remove file"
                              >
                                <X className="w-4 h-4 stroke-[2]" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Oversized Media Warning Banner */}
                {hasOversizedMedia && (
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      {hasOversizedVideo && hasOversizedPhoto
                        ? 'One or more videos (>100MB) and photos (>9MB) exceed upload limits. Remove oversized files to enable upload.'
                        : hasOversizedVideo
                        ? 'One or more videos exceed Cloudinary\'s 100MB limit. Remove oversized files to enable upload.'
                        : 'One or more photos exceed the 9MB photo limit. Remove oversized files to enable upload.'}
                    </span>
                  </div>
                )}
              </div>

              {/* Fixed Bottom Footer with Safe Area Insets */}
              <div className="px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/70 bg-white dark:bg-slate-900 flex flex-row items-center justify-end gap-2.5 w-full shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isUploading}
                  className="rounded-2xl h-10 px-4 text-xs font-bold border-border/80 cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading || selectedFiles.length === 0 || hasOversizedMedia}
                  className="rounded-2xl h-10 px-5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm gap-2 shadow-md shadow-violet-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {hasOversizedVideo && hasOversizedPhoto ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Limits Exceeded (Upload Disabled)</span>
                    </>
                  ) : hasOversizedVideo ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Video &gt; 100MB (Upload Disabled)</span>
                    </>
                  ) : hasOversizedPhoto ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Photo &gt; 9MB (Upload Disabled)</span>
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        Uploading ({completedCount}/{selectedFiles.length})...
                      </span>
                    </>
                  ) : hasErrors ? (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Retry Failed ({failedCount})</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span className="truncate">
                        {selectedFiles.length > 0
                          ? `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`
                          : 'Upload Files'}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
