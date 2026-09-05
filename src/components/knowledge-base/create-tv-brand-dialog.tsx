'use client';

import React, { useState, useTransition, useRef, useId, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tv,
  Loader2,
  Plus,
  UploadCloud,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Link as LinkIcon,
  Sparkles,
  MoreVertical,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createTvBrandAction } from '@/features/knowledge-base/actions/kb.actions';
import { formatThumbnailUrl } from '@/lib/thumbnail-utils';

export interface CreateTvBrandDialogProps {
  trigger?: React.ReactNode;
}

export function CreateTvBrandDialog({ trigger }: CreateTvBrandDialogProps = {}) {
  const clipId = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');
  const [logoUrl, setLogoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Drag & Zoom Canvas State
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Dismiss mobile virtual keyboard on touch outside inputs or scrolling
  useEffect(() => {
    if (!open) return;

    const handleTouchOutside = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        target !== activeEl
      ) {
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
          return;
        }
        activeEl.blur();
      }
    };

    const handleScroll = () => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur();
      }
    };

    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [open]);

  // Reset step to 1 when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
    }
  }, [open]);

  const handleResetPosition = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setImageAspect(null);
  };

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setImageAspect(img.naturalWidth / img.naturalHeight);
    }
  };

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
    setLogoUrl('');
    handleResetPosition();
  };

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStep(1);
      toast.error('Please enter a brand name');
      return;
    }

    startTransition(async () => {
      let baseLogoUrl = logoUrl;

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
          baseLogoUrl = uploadData.url;
        } catch (err: any) {
          toast.error(err.message || 'Image upload failed');
          return;
        }
      }

      const finalLogoUrl = (baseLogoUrl || previewUrl)
        ? formatThumbnailUrl(baseLogoUrl || previewUrl, position.x, position.y, scale)
        : undefined;

      const result = await createTvBrandAction({
        name: name.trim(),
        description: description.trim() || undefined,
        logoUrl: finalLogoUrl || undefined,
      });

      if (result.success) {
        toast.success(`Brand "${name}" created successfully`);
        setOpen(false);
        setStep(1);
        setName('');
        setDescription('');
        setLogoUrl('');
        setSelectedFile(null);
        setPreviewUrl(null);
        handleResetPosition();
      } else {
        toast.error(result.error || 'Failed to create brand');
      }
    });
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer group shrink-0"
        >
          <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Add Brand</span>
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (isPending) return;
          setOpen(val);
          if (!val) {
            setTimeout(() => setStep(1), 200);
          }
        }}
      >
        <DialogContent
          onScroll={() => {
            const activeEl = document.activeElement as HTMLElement | null;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
              activeEl.blur();
            }
          }}
          className="w-[94vw] max-w-[460px] sm:max-w-[500px] max-h-[92vh] overflow-y-auto sm:overflow-visible bg-white/95 dark:bg-slate-900/95 border border-border text-foreground backdrop-blur-2xl p-5 sm:p-6 shadow-2xl rounded-3xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* iOS-Style Header with Step Badge & Stepper Dots */}
            <DialogHeader className="space-y-2 pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs">
                    <Tv className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {step === 1 ? 'Step 1 of 2 • Brand Info' : 'Step 2 of 2 • Thumbnail'}
                  </span>
                </div>

                {/* iOS Stepper Dots */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === 1 ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
                    }`}
                  />
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === 2 ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
                    }`}
                  />
                </div>
              </div>

              <div>
                <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  {step === 1 ? 'Add TV Brand' : 'Brand Thumbnail'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {step === 1
                    ? 'Enter the manufacturer brand name and technical guidelines.'
                    : `Customize the folder thumbnail for "${name || 'Brand'}".`}
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Stepped Content with Framer Motion Animation */}
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3.5 py-1"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="create-brand-name" className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Brand Name *</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Required</span>
                    </Label>
                    <Input
                      id="create-brand-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                          if (name.trim()) {
                            setStep(2);
                          }
                        }
                      }}
                      onFocus={(e) => {
                        const len = e.target.value.length;
                        requestAnimationFrame(() => {
                          e.target.setSelectionRange(len, len);
                        });
                      }}
                      placeholder="e.g. Samsung, LG, Sony, TCL"
                      required
                      autoFocus
                      disabled={isPending}
                      className="h-11 rounded-2xl bg-muted/40 hover:bg-muted/60 focus:bg-white border-border/80 text-sm font-semibold transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-brand-desc" className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Description / Technical Notes</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                    </Label>
                    <Textarea
                      id="create-brand-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Optional technical guidelines, chassis series, or service remarks..."
                      rows={3}
                      disabled={isPending}
                      className="rounded-2xl bg-muted/40 hover:bg-muted/60 focus:bg-white border-border/80 text-sm transition-all resize-none"
                    />
                  </div>

                  {/* Next Step Teaser Card */}
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[11px] leading-tight text-foreground/80">
                      In the next step, you can upload a logo or photo and adjust it inside the TV folder silhouette.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3 py-1"
                >
                  {/* Mode Switch Tabs for Logo */}
                  <div className="flex gap-1.5 p-1 bg-muted/70 border border-border/80 rounded-2xl">
                    <Button
                      type="button"
                      size="sm"
                      variant={logoMode === 'upload' ? 'default' : 'ghost'}
                      onClick={() => setLogoMode('upload')}
                      className={`flex-1 text-xs h-8 rounded-xl font-bold transition-all ${
                        logoMode === 'upload'
                          ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Upload File
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={logoMode === 'url' ? 'default' : 'ghost'}
                      onClick={() => setLogoMode('url')}
                      className={`flex-1 text-xs h-8 rounded-xl font-bold transition-all ${
                        logoMode === 'url'
                          ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Direct URL
                    </Button>
                  </div>

                  {logoMode === 'upload' ? (
                    <div>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-2.5 flex items-center justify-center gap-3 cursor-pointer bg-muted/40 hover:bg-muted/70 active:bg-muted transition-all text-left group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-foreground block truncate">
                            {selectedFile ? selectedFile.name : 'Tap to select image'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {selectedFile ? 'Tap again to change file' : 'PNG, JPG, WebP supported'}
                          </span>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <Input
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setPreviewUrl(e.target.value.trim() || null);
                        handleResetPosition();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="https://example.com/images/brand-photo.jpg"
                      className="bg-muted/50 border-border text-xs h-9.5 rounded-xl focus-visible:ring-primary"
                    />
                  )}

                  {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING */}
                  <div className="space-y-2 p-2.5 rounded-2xl bg-muted/40 border border-border/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                          Folder Preview
                        </span>
                      </div>

                      {previewUrl && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 gap-1 py-0 px-1.5 font-bold">
                            <Move className="w-2.5 h-2.5" /> Drag to adjust
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleResetPosition}
                            className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1.5 rounded-md gap-0.5"
                            title="Reset position and zoom"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> Reset
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
                    <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
                      <defs>
                        <clipPath id={`create-brand-clip-${clipId}`} clipPathUnits="objectBoundingBox">
                          <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
                        </clipPath>
                      </defs>
                    </svg>

                    {/* Folder Silhouette Preview Canvas Container */}
                    <div className="flex justify-center py-0.5">
                      <div className="relative w-full max-w-[240px] sm:max-w-[260px] aspect-[3/2] select-none">
                        {/* 1. CLIPPED FOLDER SILHOUETTE */}
                        <div
                          ref={previewContainerRef}
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          style={{
                            clipPath: `url(#create-brand-clip-${clipId})`,
                            cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                          }}
                          className="relative w-full h-full bg-background overflow-hidden shadow-lg flex flex-col justify-end border border-border group touch-none"
                        >
                          {previewUrl ? (
                            <div className="absolute inset-0 w-full h-full overflow-hidden bg-background flex items-center justify-center">
                              <img
                                ref={imageRef}
                                src={previewUrl}
                                alt={name || 'Brand'}
                                onLoad={handleImageLoaded}
                                draggable={false}
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '50%',
                                  transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
                                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                  width: imageAspect && imageAspect > 1.5 ? `${(imageAspect / 1.5) * 100}%` : '100%',
                                  height: imageAspect && imageAspect <= 1.5 ? `${(1.5 / imageAspect) * 100}%` : '100%',
                                  pointerEvents: 'none',
                                }}
                                className="drop-shadow"
                              />
                              {/* Subtle Vignette Gradient */}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                <Tv className="w-6 h-6" />
                              </div>
                            </div>
                          )}

                          {/* 2. Floating Model Count Badge */}
                          <div className="absolute bottom-9 right-2 z-20 pointer-events-none">
                            <Badge
                              variant="secondary"
                              className="bg-background/90 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[9px] py-0 px-1.5 font-semibold shadow"
                            >
                              <Tv className="w-2.5 h-2.5 text-primary" />
                              0 Models
                            </Badge>
                          </div>

                          {/* 3. Bottom Glass Bar with Centered Brand Name */}
                          <div className="absolute bottom-0 inset-x-0 z-20 px-2.5 py-1.5 bg-background/90 backdrop-blur-md border-t border-border/60 flex items-center justify-center text-center shadow-lg pointer-events-none">
                            <h3 className="text-[11px] font-black text-foreground tracking-tight truncate w-full text-center">
                              {name || 'Brand Name'}
                            </h3>
                          </div>
                        </div>

                        {/* 4. Vector Neon Glow Outline */}
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient id={`create-brand-neonGrad-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                              <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.6" />
                              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.8" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 6,100 A 6,8 0 0,1 0,92 L 0,8 A 6,8 0 0,1 6,0 L 30,0 C 34,0 33,13.5 37,13.5 L 94,13.5 A 6,8 0 0,1 100,21.5 L 100,92 A 6,8 0 0,1 94,100 Z"
                            fill="none"
                            stroke={`url(#create-brand-neonGrad-${clipId})`}
                            strokeWidth="1.75"
                            vectorEffect="non-scaling-stroke"
                            className="drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]"
                          />
                        </svg>

                        {/* 5. Highlighted 3-Dots Menu Pill Simulation */}
                        <div className="absolute top-5 right-1.5 z-40 pointer-events-none">
                          <div className="h-5 w-5 rounded-md bg-white/90 border border-primary/30 text-primary flex items-center justify-center shadow-xs">
                            <MoreVertical className="h-2.5 w-2.5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Positioning & Zoom Controls - NO PAN COORDINATE PARAMETER TEXT! */}
                    {previewUrl && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScale((s) => Math.max(1, s - 0.1))}
                          disabled={scale <= 1}
                          className="h-7 w-7 rounded-lg border-border bg-muted/80 text-foreground shrink-0 p-0"
                          title="Zoom out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </Button>

                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.05"
                          value={scale}
                          onChange={(e) => setScale(parseFloat(e.target.value))}
                          className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                          disabled={scale >= 3}
                          className="h-7 w-7 rounded-lg border-border bg-muted/80 text-foreground shrink-0 p-0"
                          title="Zoom in"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </Button>

                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-8 text-right shrink-0">
                          {scale.toFixed(1)}x
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer Navigation Buttons */}
            <DialogFooter className="pt-2 gap-2 flex-row justify-between items-center border-t border-border/60">
              {step === 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="rounded-2xl text-xs h-10 px-4 cursor-pointer font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!name.trim()) {
                        toast.error('Please enter a brand name');
                        return;
                      }
                      setStep(2);
                    }}
                    disabled={!name.trim()}
                    className="rounded-2xl text-xs h-10 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Next: Thumbnail</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={isPending}
                    className="rounded-2xl text-xs h-10 px-4 cursor-pointer font-semibold gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending || !name.trim()}
                    className="rounded-2xl text-xs h-10 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Create Brand Folder</span>
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
