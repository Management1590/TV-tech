'use client';

import React, { useState, useTransition, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ImagePlus,
  Link as LinkIcon,
  Trash2,
  Loader2,
  UploadCloud,
  Tv,
  Check,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { setTvBrandThumbnailAction } from '@/features/knowledge-base/actions/kb.actions';
import { parseThumbnailUrl, formatThumbnailUrl } from '@/lib/thumbnail-utils';

interface SetBrandThumbnailDialogProps {
  brandId: string;
  brandName: string;
  currentLogoUrl?: string | null;
  currentDescription?: string | null;
  modelCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetBrandThumbnailDialog({
  brandId,
  brandName,
  currentLogoUrl,
  currentDescription,
  modelCount = 0,
  open,
  onOpenChange,
}: SetBrandThumbnailDialogProps) {
  const router = useRouter();
  const clipId = useId().replace(/:/g, '');
  const cleanName = brandName.replace(/_\d{10,}$/, '');

  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(currentLogoUrl || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  // Positioning & Zoom state
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when dialog is active
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  // Sync with current thumbnail on open (Lossless original URL + saved pan/zoom restore)
  useEffect(() => {
    if (open) {
      const parsed = parseThumbnailUrl(currentLogoUrl);
      setThumbnailUrl(parsed.url);
      setPreviewUrl(parsed.url || null);
      setSelectedFile(null);
      setScale(parsed.scale);
      setPosition({ x: parsed.x, y: parsed.y });
    }
  }, [open, currentLogoUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setThumbnailUrl('');
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse / Touch Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewUrl) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setPosition({
      x: dragStartRef.current.initX + deltaX,
      y: dragStartRef.current.initY + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!previewUrl || e.touches.length === 0) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length === 0) return;
    e.stopPropagation();
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.startX;
    const deltaY = touch.clientY - dragStartRef.current.startY;
    setPosition({
      x: dragStartRef.current.initX + deltaX,
      y: dragStartRef.current.initY + deltaY,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleResetPosition = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Lossless save: preserve original image file and store pan/zoom offsets
  const handleSave = () => {
    if (!previewUrl) {
      startTransition(async () => {
        const res = await setTvBrandThumbnailAction(brandId, null);
        if (res.success) {
          toast.success(`Thumbnail removed for "${brandName}"`);
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to update thumbnail');
        }
      });
      return;
    }

    startTransition(async () => {
      let baseImageUrl = thumbnailUrl;

      // If user uploaded a new local file, upload via direct multipart API first
      if (selectedFile) {
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('folder', 'tv-tech-os/brands');

          const uploadRes = await fetch('/api/media/upload-thumbnail', {
            method: 'POST',
            body: formData,
          });
          const uploadData = await uploadRes.json();

          if (!uploadData.success || !uploadData.url) {
            toast.error(uploadData.error || 'Failed to upload image to CDN');
            return;
          }
          baseImageUrl = uploadData.url;
        } catch (err: any) {
          toast.error(err.message || 'Image upload failed');
          return;
        }
      }

      const finalUrl = formatThumbnailUrl(baseImageUrl || previewUrl, position.x, position.y, scale);
      const res = await setTvBrandThumbnailAction(brandId, finalUrl || null);
      if (res.success) {
        toast.success(`Thumbnail updated for "${brandName}"`);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update brand thumbnail');
      }
    });
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setThumbnailUrl('');
    handleResetPosition();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[120] flex flex-col justify-end items-center select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPending) {
                onOpenChange(false);
              }
            }}
          >
            {/* Backdrop Blur Layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer"
              onClick={() => {
                if (!isPending) onOpenChange(false);
              }}
            />

            {/* iOS Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
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
                if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                  onOpenChange(false);
                }
              }}
              className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden will-change-transform transform-gpu select-text"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
              >
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
              </div>

              {/* Header */}
              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (target?.closest('button') || target?.closest('a') || target?.closest('input')) return;
                  dragControls.start(e);
                }}
                className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <ImagePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                      Brand Thumbnail & Silhouette
                    </h2>
                    <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                      Upload and adjust position for <span className="text-primary font-semibold">&ldquo;{brandName}&rdquo;</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPending) onOpenChange(false);
                  }}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content Body - Non-scrollable with compact studio */}
              <div className={`px-5 sm:px-6 py-2 space-y-2.5 flex-1 ${previewUrl ? 'overflow-hidden overscroll-none' : 'overflow-y-auto no-scrollbar'}`}>
                {/* Hidden File Input always mounted so trigger works in both modes */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="brand-thumbnail-upload"
                />

                {/* Image Selection Strip: Collapsed when image loaded, full selector when empty */}
                {!previewUrl ? (
                  <div className="space-y-2">
                    {/* Mode Switch Tabs */}
                    <div className="flex gap-1.5 p-1 bg-muted/70 border border-border/80 rounded-2xl">
                      <Button
                        type="button"
                        size="sm"
                        variant={mode === 'upload' ? 'default' : 'ghost'}
                        onClick={() => setMode('upload')}
                        className={`flex-1 text-xs h-7.5 rounded-xl font-bold transition-all cursor-pointer ${
                          mode === 'upload'
                            ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Upload File
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={mode === 'url' ? 'default' : 'ghost'}
                        onClick={() => setMode('url')}
                        className={`flex-1 text-xs h-7.5 rounded-xl font-bold transition-all cursor-pointer ${
                          mode === 'url'
                            ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Direct URL
                      </Button>
                    </div>

                    {/* Upload Input */}
                    {mode === 'upload' ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-border/80 hover:border-primary/50 active:scale-[0.99] rounded-2xl p-2.5 flex items-center justify-center gap-3 cursor-pointer bg-muted/40 hover:bg-muted/70 transition-all text-left group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-foreground block">
                            Select Brand Photo or Logo
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            PNG, JPG, WebP (tap to browse)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input
                          value={thumbnailUrl}
                          onChange={(e) => {
                            setThumbnailUrl(e.target.value);
                            setPreviewUrl(e.target.value.trim() || null);
                            handleResetPosition();
                          }}
                          placeholder="https://example.com/images/brand-photo.jpg"
                          className="bg-muted/40 border-border/80 text-xs h-9 rounded-xl focus-visible:ring-primary"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Ultra-Compact File Info Bar (Frees up vertical space so sheet never scrolls) */
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-muted/50 border border-border/80 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                          {selectedFile ? selectedFile.name : (thumbnailUrl ? 'Custom Brand Photo' : 'Brand Artwork')}
                        </p>
                        <p className="text-[9.5px] text-muted-foreground leading-tight">
                          {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB • Ready to position` : 'Ready to adjust'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (mode === 'upload') {
                            fileInputRef.current?.click();
                          } else {
                            setPreviewUrl(null);
                            setThumbnailUrl('');
                          }
                        }}
                        className="h-6 px-2 text-[10px] font-bold rounded-lg bg-background hover:bg-muted text-foreground cursor-pointer"
                      >
                        Change
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleRemove}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                        title="Remove image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING STUDIO */}
                <div className="space-y-1.5 p-2 rounded-2xl bg-muted/40 border border-border/80">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                        Folder Silhouette Preview
                      </span>
                    </div>

                    {previewUrl ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 gap-1 py-0 px-1.5 font-bold">
                          <Move className="w-2.5 h-2.5" /> Drag to pan
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleResetPosition}
                          className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1.5 rounded-md gap-0.5 cursor-pointer"
                          title="Reset position and zoom"
                        >
                          <RotateCcw className="w-2.5 h-2.5" /> Reset
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-muted-foreground">Default silhouette</span>
                    )}
                  </div>

                  {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
                  <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
                    <defs>
                      <clipPath id={`dialog-brand-clip-${clipId}`} clipPathUnits="objectBoundingBox">
                        <path d="M 0.16,1 A 0.16,0.16 0 0,1 0,0.84 L 0,0.14 A 0.14,0.14 0 0,1 0.14,0 L 0.33,0 C 0.40,0 0.41,0.15 0.48,0.15 L 0.86,0.15 A 0.14,0.14 0 0,1 1,0.29 L 1,0.84 A 0.16,0.16 0 0,1 0.84,1 Z" />
                      </clipPath>
                    </defs>
                  </svg>

                  {/* Folder Silhouette Preview Canvas Container - Exact 1:1 match to BrandFolderCard */}
                  <div className="flex justify-center py-1 select-none">
                    <div className="relative w-[175px] h-[155px] select-none filter drop-shadow-md">
                      {/* 1. CLIPPED FOLDER SILHOUETTE */}
                      <div
                        ref={previewContainerRef}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e);
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          handleTouchStart(e);
                        }}
                        onTouchMove={(e) => {
                          e.stopPropagation();
                          handleTouchMove(e);
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          handleTouchEnd();
                        }}
                        style={{
                          clipPath: `url(#dialog-brand-clip-${clipId})`,
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -3px rgba(100,116,145,0.12), 0 20px 40px -4px rgba(100,116,145,0.08)',
                          cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        }}
                        className="relative w-full h-full bg-muted overflow-hidden flex flex-col justify-end group touch-none select-none"
                      >
                        {previewUrl ? (
                          <div className="absolute inset-0 w-full h-full overflow-hidden bg-muted/80 flex items-center justify-center pointer-events-none">
                            <img
                              ref={imageRef}
                              src={previewUrl}
                              alt={cleanName}
                              draggable={false}
                              style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transformOrigin: 'center center',
                                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                              }}
                              className="w-full h-full object-cover select-none pointer-events-none"
                            />
                            {/* Subtle bottom vignette for text contrast */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />
                          </div>
                        ) : (
                          /* Default Icon canvas when no thumbnail - 100% matched to BrandFolderCard */
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-indigo-100/60 to-muted/90 flex items-center justify-center overflow-hidden pointer-events-none">
                            {/* Soft radial primary ambient glow */}
                            <div className="absolute w-40 h-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
                            {/* Geometric pattern */}
                            <div
                              className="absolute inset-0 opacity-[0.07]"
                              style={{
                                backgroundImage: 'radial-gradient(oklch(0.40 0.22 260) 1.2px, transparent 1.2px)',
                                backgroundSize: '16px 16px',
                              }}
                            />
                            <div className="relative flex flex-col items-center justify-center text-center p-2">
                              <div className="w-11 h-11 rounded-xl bg-white/95 border border-primary/30 shadow-md flex items-center justify-center text-primary">
                                <Tv className="w-5 h-5 text-primary" />
                              </div>
                              {currentDescription && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 max-w-[130px] font-semibold">
                                  {currentDescription}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. Floating Model Count Badge - 100% matched to BrandFolderCard */}
                        <div className="absolute bottom-9 right-2 z-20 pointer-events-none">
                          <Badge
                            variant="secondary"
                            className="bg-white/95 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[10px] py-0.5 px-1.5 font-bold shadow-md"
                          >
                            <Tv className="w-3 h-3 text-primary" />
                            {modelCount} {modelCount === 1 ? 'Model' : 'Models'}
                          </Badge>
                        </div>

                        {/* 3. Bottom Bar with Centered Brand Name - 100% matched to BrandFolderCard */}
                        <div className="relative z-20 px-2 py-2 bg-white/95 backdrop-blur-md border-t border-border/80 flex items-center justify-center text-center shadow-sm pointer-events-none">
                          <h3
                            className="text-xs font-bold text-foreground tracking-tight truncate leading-tight w-full text-center"
                            title={cleanName}
                          >
                            {cleanName}
                          </h3>
                        </div>
                      </div>

                      {/* 4. Clean Perimeter Border Contour - 100% matched to BrandFolderCard */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M 16,100 A 16,16 0 0,1 0,84 L 0,14 A 14,14 0 0,1 14,0 L 33,0 C 40,0 41,15 48,15 L 86,15 A 14,14 0 0,1 100,29 L 100,84 A 16,16 0 0,1 84,100 Z"
                          fill="none"
                          stroke="rgba(100, 116, 139, 0.4)"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Positioning & Zoom Controls (Visible when image is loaded) */}
                  {previewUrl && (
                    <div
                      className="flex items-center gap-2 pt-1 border-t border-border/50"
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScale((s) => Math.max(1, Number((s - 0.1).toFixed(2))))}
                        disabled={scale <= 1}
                        className="h-6.5 w-6.5 rounded-lg border-border bg-muted/80 text-foreground shrink-0 p-0 cursor-pointer"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </Button>

                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex-1 accent-primary h-1 bg-muted rounded-lg cursor-pointer"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}
                        disabled={scale >= 3}
                        className="h-6.5 w-6.5 rounded-lg border-border bg-muted/80 text-foreground shrink-0 p-0 cursor-pointer"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </Button>

                      <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-7 text-right shrink-0">
                        {scale.toFixed(1)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>

        {/* iOS Footer with safe area padding */}
        <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
          <div>
            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={isPending}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Remove
              </Button>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-9 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="h-9 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-sm"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
        )}
      </AnimatePresence>,
      document.body
    )
  );
}
