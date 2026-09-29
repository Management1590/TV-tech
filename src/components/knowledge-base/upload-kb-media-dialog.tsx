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
  status: 'idle' | 'preparing' | 'uploading' | 'compressing' | 'registering' | 'completed' | 'error';
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

  // Refs for auto-scrolling active uploading file into view
  const activeCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Bulletproof mobile & desktop background scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyPosition = document.body.style.position;
    const origBodyTop = document.body.style.top;
    const origBodyWidth = document.body.style.width;

    // Freeze window & background page completely
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    // Suppress background floating FABs
    window.dispatchEvent(
      new CustomEvent('tv-tech-suppress-floating-fabs', {
        detail: { suppressed: true },
      })
    );

    return () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
      document.body.style.position = origBodyPosition;
      document.body.style.top = origBodyTop;
      document.body.style.width = origBodyWidth;
      window.scrollTo(0, scrollY);

      window.dispatchEvent(
        new CustomEvent('tv-tech-suppress-floating-fabs', {
          detail: { suppressed: false },
        })
      );
    };
  }, [isOpen]);

  // Smoothly auto-scroll active uploading card into view on mobile
  useEffect(() => {
    if (isUploading && selectedFiles.length > 0 && activeCardRefs.current[currentFileIndex]) {
      activeCardRefs.current[currentFileIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentFileIndex, isUploading, selectedFiles.length]);

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
                  status: 'uploading',
                  progress: 5,
                  subtitle: 'Uploading...',
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
                } else if (stage === 'compressing') {
                  subtitle = details?.statusText || (f.file.type.startsWith('video/') ? 'Cloudinary compressing video (auto:eco)...' : 'Cloudinary compressing image (auto:good)...');
                } else if (stage === 'uploading') {
                  if (details?.formattedLoaded && details?.formattedTotal) {
                    subtitle = `${details.formattedLoaded} / ${details.formattedTotal}`;
                  } else {
                    subtitle = `${formatFileSize((f.file.size * filePct) / 100)} / ${f.sizeFormatted}`;
                  }
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
          const finalSizeBytes = uploadResult.media.sizeBytes || item.file.size;
          const finalFormatted = formatFileSize(finalSizeBytes);
          const wasCompressed = uploadResult.media.sizeBytes && uploadResult.media.sizeBytes < item.file.size;
          const isVideo = item.file.type.startsWith('video/');
          const compressionLabel = isVideo ? 'auto:eco' : 'auto:good';
          const doneSubtitle = wasCompressed
            ? `${finalFormatted} (${compressionLabel}) - Done`
            : `${finalFormatted} - Done`;

          setSelectedFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: 'completed',
                    progress: 100,
                    subtitle: doneSubtitle,
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
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
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

              {/* Body Content - Single Unified Scroll Container with smooth momentum & overscroll containment */}
              <div className="space-y-4 px-4 sm:px-6 pt-3 pb-8 w-full max-w-full overflow-y-auto overscroll-contain flex-1 min-h-0">
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
                        ? 'border-2 border-dashed border-blue-500 bg-blue-500/10 scale-[0.99] shadow-lg shadow-blue-500/20'
                        : 'border-2 border-dashed border-blue-400/40 dark:border-blue-500/30 hover:border-blue-600 dark:hover:border-blue-400 bg-gradient-to-b from-blue-500/[0.05] via-sky-500/[0.02] to-transparent hover:from-blue-500/[0.09] shadow-xs hover:shadow-xl hover:shadow-blue-500/10 active:scale-[0.985]'
                    }`}
                  >
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-radial from-blue-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    {/* Click SVG Centerpiece */}
                    <div className="relative mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-blue-500/15 via-sky-500/10 to-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-108 transition-all duration-300">
                      <MousePointerClick className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
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
                        className="h-11 sm:h-12 px-7 sm:px-9 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 hover:from-blue-500 hover:via-sky-500 hover:to-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-blue-500/35 hover:shadow-xl hover:shadow-blue-500/50 active:scale-95 transition-all gap-2.5 cursor-pointer border-0 ring-4 ring-blue-500/15 hover:ring-blue-500/30"
                      >
                        <MousePointerClick className="w-4 h-4 text-blue-100" />
                        <span>Choose Files</span>
                      </Button>
                    </div>

                    {/* Quality Assurance Tag */}
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 pt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Cloudinary Auto-Compressed Video (q_auto:eco) & Photo</span>
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
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <div className="p-3.5 rounded-2xl bg-blue-500/[0.06] dark:bg-blue-950/30 border border-blue-500/25 flex flex-col gap-2 text-xs animate-in fade-in duration-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse shrink-0" />
                            <span className="font-semibold text-foreground truncate">
                              Uploading file {Math.min(selectedFiles.length, currentFileIndex + 1)} of{' '}
                              {selectedFiles.length}...
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-blue-700 dark:text-blue-300 shrink-0">
                            {overallProgress}% Total
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 transition-all duration-300 ease-out"
                            style={{ width: `${Math.max(4, overallProgress)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stacked File Cards List — Full Height Flow (Smooth Scroll, Zero Cropping) */}
                    <div className="flex flex-col gap-2.5 w-full">
                      {selectedFiles.map((item, idx) => {
                        const isDone = item.status === 'completed';
                        const isError = item.status === 'error';
                        const isCompressing = item.status === 'compressing';
                        const isInProgress =
                           item.status === 'uploading' ||
                           item.status === 'compressing' ||
                           item.status === 'registering' ||
                           item.status === 'preparing';

                        return (
                          <div
                            key={item.id}
                            ref={(el) => {
                              activeCardRefs.current[idx] = el;
                            }}
                            className={`border rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 transition-all duration-200 group relative w-full shrink-0 ${
                              isDone
                                ? 'bg-emerald-500/[0.03] dark:bg-emerald-950/20 border-emerald-500/30 dark:border-emerald-500/25 shadow-2xs'
                                : isError
                                ? 'bg-rose-500/[0.03] dark:bg-rose-950/20 border-rose-500/30 dark:border-rose-500/30 shadow-2xs'
                                : isCompressing
                                ? 'bg-blue-500/[0.04] dark:bg-blue-950/25 border-blue-500/40 dark:border-blue-500/40 shadow-xs ring-1 ring-blue-500/20'
                                : isInProgress
                                ? 'bg-blue-500/[0.03] dark:bg-blue-950/20 border-blue-500/30 dark:border-blue-500/30 shadow-xs ring-1 ring-blue-500/15'
                                : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                            }`}
                          >
                            {/* ROW 1: Media Icon/Thumbnail + Title/Metadata + Status Pill / Remove */}
                            <div className="flex items-center gap-3 sm:gap-3.5 w-full min-w-0">
                              {/* Left: Thumbnail Squircle */}
                              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                                {item.previewUrl ? (
                                  <img
                                    src={item.previewUrl}
                                    alt={item.file.name}
                                    className="w-full h-full object-cover rounded-xl"
                                  />
                                ) : item.isVideo ? (
                                  <div className="w-full h-full rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <Film className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                                  </div>
                                ) : (
                                  <div className="w-full h-full rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <ImageIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                                  </div>
                                )}

                                {/* Small corner completion badge on thumbnail */}
                                {isDone && (
                                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                              </div>

                              {/* Center: File Title + Size/Type Badges */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-xs sm:text-sm font-bold text-foreground truncate select-none leading-snug tracking-tight"
                                  title={item.file.name}
                                >
                                  {item.file.name}
                                </p>

                                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground select-none">
                                  <span className="font-mono font-medium">{item.sizeFormatted}</span>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-muted text-muted-foreground">
                                    {item.isVideo ? 'Video' : 'Photo'}
                                  </span>
                                  {isCompressing && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                      {item.isVideo ? 'auto:eco' : 'auto:good'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Status Pill or Remove Action Button */}
                              <div className="flex items-center gap-2 shrink-0 select-none">
                                {isDone ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold shadow-2xs">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Ready</span>
                                  </div>
                                ) : isError ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold">
                                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Failed</span>
                                  </div>
                                ) : isCompressing ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-xs font-mono font-bold tracking-tight shadow-xs">
                                    <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                                    <span>{item.progress}%</span>
                                  </div>
                                ) : isInProgress ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-mono font-bold tracking-tight">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                                    <span>{item.progress}%</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFile(item.id)}
                                    disabled={isUploading}
                                    className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                                    title="Remove file"
                                    aria-label="Remove file"
                                  >
                                    <X className="w-4 h-4 stroke-[2]" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* ROW 2: Live Progress & Status (When uploading, compressing, registering, or completed) */}
                            {(isInProgress || isDone || isError) && (
                              <div className="flex flex-col gap-1.5 w-full pt-0.5">
                                {/* Subtitle / Live Phase Status Line */}
                                <div className="flex items-center justify-between text-[11px] sm:text-xs font-medium w-full min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                                    {isCompressing ? (
                                      <span className="text-blue-600 dark:text-blue-400 font-semibold truncate flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                                        <span className="truncate">
                                          {item.subtitle || 'Cloudinary compressing video (auto:eco)...'}
                                        </span>
                                      </span>
                                    ) : item.status === 'uploading' ? (
                                      <span className="text-blue-600 dark:text-blue-400 font-medium truncate flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                        <span className="truncate">Streaming media payload to Cloudinary CDN...</span>
                                      </span>
                                    ) : item.status === 'registering' ? (
                                      <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate flex items-center gap-1.5">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />
                                        <span className="truncate">Saving media records to cloud database...</span>
                                      </span>
                                    ) : isDone ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate flex items-center gap-1.5">
                                        <Check className="w-3 h-3 stroke-[3] shrink-0" />
                                        <span className="truncate">{item.subtitle}</span>
                                      </span>
                                    ) : isError ? (
                                      <span
                                        className="text-rose-600 dark:text-rose-400 font-medium truncate"
                                        title={item.error || item.subtitle}
                                      >
                                        {item.error || item.subtitle || 'Upload failed'}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground truncate">{item.subtitle}</span>
                                    )}
                                  </div>

                                  {/* Right Data Metric on Status Line */}
                                  {item.status === 'uploading' && (
                                    <span className="font-mono text-[11px] text-muted-foreground shrink-0 ml-2">
                                      {item.loadedFormatted || '0 B'} / {item.totalFormatted || item.sizeFormatted}
                                    </span>
                                  )}
                                </div>

                                {/* Full-Width Sleek Linear Progress Bar */}
                                <div className="relative w-full h-1.5 sm:h-2 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                                      isDone
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                        : isCompressing
                                        ? 'bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 animate-pulse shadow-sm shadow-blue-500/30'
                                        : item.status === 'uploading' || item.status === 'preparing'
                                        ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-blue-500'
                                        : item.status === 'registering'
                                        ? 'bg-gradient-to-r from-sky-500 to-blue-600'
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
                                          : `${Math.max(6, item.progress)}%`,
                                    }}
                                  />
                                  {/* Subtle animated highlight pulse while uploading or compressing */}
                                  {isInProgress && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse pointer-events-none" />
                                  )}
                                </div>
                              </div>
                            )}
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
              <div className="px-4 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-row items-center justify-end gap-2.5 w-full shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isUploading}
                  className="rounded-2xl h-11 px-5 text-xs font-bold border-border/80 cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading || selectedFiles.length === 0 || hasOversizedMedia}
                  className="rounded-2xl h-11 px-6 bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 hover:from-blue-500 hover:via-sky-500 hover:to-blue-500 text-white font-extrabold text-xs sm:text-sm gap-2 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
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
