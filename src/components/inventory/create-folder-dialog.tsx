'use client';

import React, { useState, useTransition, useRef, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderPlus,
  Loader2,
  ImagePlus,
  UploadCloud,
  Link as LinkIcon,
  Trash2,
  Folder,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Package,
  MoreVertical,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createFolderAction } from '@/features/inventory/actions/folder.actions';
import { formatThumbnailUrl } from '@/lib/thumbnail-utils';

interface CreateFolderDialogProps {
  parentId?: string | null;
  trigger?: React.ReactNode;
}

export function CreateFolderDialog({ parentId, trigger }: CreateFolderDialogProps) {
  const clipId = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailMode, setThumbnailMode] = useState<'upload' | 'url'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [imageAspect, setImageAspect] = useState<number | null>(null);
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

  // Reset state when opening/closing
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setThumbnailUrl('');
      setPreviewUrl(null);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setImageAspect(null);
    }
  }, [open]);

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

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setThumbnailUrl(result);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setImageAspect(null);
    };
    reader.readAsDataURL(file);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    startTransition(async () => {
      const finalThumbnailUrl = (thumbnailUrl || previewUrl)
        ? formatThumbnailUrl(thumbnailUrl || previewUrl, position.x, position.y, scale)
        : undefined;

      const result = await createFolderAction({
        name: name.trim(),
        description: description.trim() || undefined,
        parentId,
        thumbnailUrl: finalThumbnailUrl,
      });

      if (result.success) {
        toast.success(`Folder "${name.trim()}" created successfully`);
        setOpen(false);
      } else {
        toast.error(result.error || 'Failed to create folder');
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
          onClick={() => setOpen(true)}
          size="sm"
          className="group h-9 sm:h-10 px-3 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm bg-amber-500/10 text-amber-800 border-2 border-amber-400/80 shadow-xs hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md hover:shadow-amber-500/25 transition-all duration-200 active:scale-95 cursor-pointer gap-1.5 sm:gap-2 shrink-0"
        >
          <FolderPlus className="h-4 w-4 text-amber-600 group-hover:text-white transition-colors shrink-0" />
          <span>New Folder</span>
        </Button>
      )}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                className="fixed inset-0 z-[120] flex flex-col justify-end items-center select-none"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    setOpen(false);
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
                    if (!isPending) setOpen(false);
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
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.2 }}
                  onDragEnd={(_, info) => {
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      setOpen(false);
                    }
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <FolderPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          Create New Folder
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          Add a new categorization container with custom artwork
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPending) setOpen(false);
                      }}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Scrollable Content */}
                    <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar flex-1">
                      {/* Folder Name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="folder-name" className="text-xs font-semibold text-foreground">
                          Folder Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="folder-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Backlight Strips, Power Supplies, Samsung Panels"
                          className="bg-muted border-border text-xs h-9.5 rounded-xl focus-visible:ring-primary"
                          autoFocus
                          disabled={isPending}
                        />
                      </div>

                      {/* Folder Description */}
                      <div className="space-y-1.5">
                        <Label htmlFor="folder-description" className="text-xs font-semibold text-foreground">
                          Description <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
                        </Label>
                        <Textarea
                          id="folder-description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Brief notes about the components or models inside this folder..."
                          className="bg-muted border-border text-xs rounded-xl min-h-[60px] resize-none focus-visible:ring-primary"
                          disabled={isPending}
                        />
                      </div>

                      {/* Thumbnail Mode Selector */}
                      <div className="space-y-2 pt-1 border-t border-border/40">
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="create-folder-upload"
                        />

                        {!previewUrl ? (
                          <>
                            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <ImagePlus className="w-3.5 h-3.5 text-primary" /> Folder Silhouette Thumbnail{' '}
                              <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
                            </Label>

                            <div className="flex gap-1.5 p-1 bg-muted/70 border border-border/80 rounded-xl">
                              <Button
                                type="button"
                                size="sm"
                                variant={thumbnailMode === 'upload' ? 'default' : 'ghost'}
                                onClick={() => setThumbnailMode('upload')}
                                className={`flex-1 text-xs h-7.5 rounded-lg font-semibold transition-all cursor-pointer ${
                                  thumbnailMode === 'upload'
                                    ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Upload File
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={thumbnailMode === 'url' ? 'default' : 'ghost'}
                                onClick={() => setThumbnailMode('url')}
                                className={`flex-1 text-xs h-7.5 rounded-lg font-semibold transition-all cursor-pointer ${
                                  thumbnailMode === 'url'
                                    ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Direct URL
                              </Button>
                            </div>

                            {/* Upload Input */}
                            {thumbnailMode === 'upload' ? (
                              <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-border/80 hover:border-primary/50 active:scale-[0.99] rounded-2xl p-2.5 flex items-center justify-center gap-3 cursor-pointer bg-muted/40 hover:bg-muted/70 transition-all text-left group"
                              >
                                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                  <UploadCloud className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-bold text-foreground block">
                                    Select Folder Photo or Artwork
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    PNG, JPG, WebP (tap to browse)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <Input
                                value={thumbnailUrl}
                                onChange={(e) => {
                                  setThumbnailUrl(e.target.value);
                                  setPreviewUrl(e.target.value.trim() || null);
                                  handleResetPosition();
                                }}
                                placeholder="https://example.com/images/spare-part.jpg"
                                className="bg-muted/40 border-border/80 text-xs h-9 rounded-xl focus-visible:ring-primary"
                              />
                            )}
                          </>
                        ) : (
                          /* Ultra-Compact File Info Bar */
                          <div className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-muted/50 border border-border/80 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                                <Sparkles className="w-3 h-3" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                                  {thumbnailUrl ? 'Custom Folder Artwork' : 'Selected Photo'}
                                </p>
                                <p className="text-[9.5px] text-muted-foreground leading-tight">
                                  Ready to position in silhouette
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (thumbnailMode === 'upload') {
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
                                onClick={() => {
                                  setPreviewUrl(null);
                                  setThumbnailUrl('');
                                  handleResetPosition();
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                title="Remove image"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING STUDIO */}
                        <div className="space-y-1.5 p-2 rounded-2xl bg-muted/40 border border-border/80 mt-1">
                          <div className="flex items-center justify-between px-0.5">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                                Live Preview
                              </span>
                            </div>

                            {previewUrl ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 gap-1 px-1.5 py-0 font-bold">
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
                              <clipPath id={`create-folder-clip-${clipId}`} clipPathUnits="objectBoundingBox">
                                <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
                              </clipPath>
                            </defs>
                          </svg>

                          {/* Folder Silhouette Preview Canvas Container */}
                          <div className="flex justify-center py-0.5">
                            <div className="relative w-full max-w-[195px] xs:max-w-[205px] aspect-[3/2] select-none">
                              {/* 1. CLIPPED FOLDER SILHOUETTE */}
                              <div
                                ref={previewContainerRef}
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
                                  clipPath: `url(#create-folder-clip-${clipId})`,
                                  cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                }}
                                className="relative w-full h-full bg-background overflow-hidden shadow-md flex flex-col justify-end border border-border group touch-none select-none"
                              >
                                {previewUrl ? (
                                  <div className="absolute inset-0 w-full h-full overflow-hidden bg-background flex items-center justify-center">
                                    <img
                                      ref={imageRef}
                                      src={previewUrl}
                                      alt="Folder Preview"
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
                                      className="drop-shadow select-none"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-primary/5 flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                      <Folder className="w-5 h-5" />
                                    </div>
                                  </div>
                                )}

                                {/* 2. Floating Item Count Badge */}
                                <div className="absolute bottom-8 right-2 z-20 pointer-events-none">
                                  <Badge
                                    variant="secondary"
                                    className="bg-background/90 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[8.5px] py-0 px-1.5 font-semibold shadow-xs"
                                  >
                                    <Package className="w-2 h-2 text-primary" />
                                    0 items
                                  </Badge>
                                </div>

                                {/* 3. Bottom Glass Bar with Centered Folder Name */}
                                <div className="absolute bottom-0 inset-x-0 z-20 px-2 py-1 bg-background/90 backdrop-blur-md border-t border-border/60 flex items-center justify-center text-center shadow-md pointer-events-none">
                                  <h3 className="text-[10px] font-black text-foreground tracking-tight truncate w-full text-center">
                                    {name.trim() || 'New Folder'}
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
                                  <linearGradient id={`create-folder-neonGrad-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                                    <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.6" />
                                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.8" />
                                  </linearGradient>
                                </defs>
                                <path
                                  d="M 6,100 A 6,8 0 0,1 0,92 L 0,8 A 6,8 0 0,1 6,0 L 30,0 C 34,0 33,13.5 37,13.5 L 94,13.5 A 6,8 0 0,1 100,21.5 L 100,92 A 6,8 0 0,1 94,100 Z"
                                  fill="none"
                                  stroke={`url(#create-folder-neonGrad-${clipId})`}
                                  strokeWidth="1.75"
                                  vectorEffect="non-scaling-stroke"
                                  className="drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]"
                                />
                              </svg>

                              {/* 5. Highlighted 3-Dots Menu Pill Simulation */}
                              <div className="absolute top-4.5 right-1.5 z-40 pointer-events-none">
                                <div className="h-4.5 w-4.5 rounded-md bg-white/90 border border-primary/30 text-primary flex items-center justify-center shadow-xs">
                                  <MoreVertical className="h-2.5 w-2.5" />
                                </div>
                              </div>
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
                                <ZoomIn className="w-3.5 h-3.5" />
                              </Button>

                              <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-7 text-right shrink-0">
                                {scale.toFixed(1)}x
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* iOS Footer with safe area padding */}
                    <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                        className="h-9 text-xs rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending || !name.trim()}
                        className="h-9 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 shadow-sm"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Create Folder
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
