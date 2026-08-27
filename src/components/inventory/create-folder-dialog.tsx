'use client';

import React, { useState, useTransition, useRef, useId, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
    <Dialog open={open} onOpenChange={isPending ? undefined : setOpen}>
      <DialogTrigger>
        {trigger || (
          <Button
            size="sm"
            className="group h-9 sm:h-10 px-3 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm bg-amber-500/10 text-amber-800 border-2 border-amber-400/80 shadow-xs hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md hover:shadow-amber-500/25 transition-all duration-200 active:scale-95 cursor-pointer gap-1.5 sm:gap-2 shrink-0"
          >
            <FolderPlus className="h-4 w-4 text-amber-600 group-hover:text-white transition-colors shrink-0" />
            <span>New Folder</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto bg-white/95 border-border text-foreground backdrop-blur-2xl p-6 shadow-2xl rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <FolderPlus className="w-4 h-4" />
              </div>
              Create New Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new categorization container with custom name and silhouette artwork.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
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
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5 text-primary" /> Folder Silhouette Thumbnail{' '}
                <span className="text-muted-foreground text-[10px] font-normal">(Optional)</span>
              </Label>

              <div className="flex gap-2 p-1 bg-muted border border-border rounded-xl">
                <Button
                  type="button"
                  size="sm"
                  variant={thumbnailMode === 'upload' ? 'default' : 'ghost'}
                  onClick={() => setThumbnailMode('upload')}
                  className={`flex-1 text-xs h-8 rounded-lg font-semibold transition-all ${
                    thumbnailMode === 'upload'
                      ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
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
                  className={`flex-1 text-xs h-8 rounded-lg font-semibold transition-all ${
                    thumbnailMode === 'url'
                      ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Direct URL
                </Button>
              </div>

              {/* Upload Input */}
              {thumbnailMode === 'upload' && (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="create-folder-upload"
                  />
                  <label
                    htmlFor="create-folder-upload"
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border hover:border-blue-500/50 rounded-2xl cursor-pointer bg-muted/40 hover:bg-muted/80 transition-all text-center group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">Click or drag image file here</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Supports high-resolution PNG, JPG, WebP</p>
                  </label>
                </div>
              )}

              {/* URL Input */}
              {thumbnailMode === 'url' && (
                <div className="space-y-1.5">
                  <Input
                    value={thumbnailUrl}
                    onChange={(e) => {
                      setThumbnailUrl(e.target.value);
                      setPreviewUrl(e.target.value.trim() || null);
                      handleResetPosition();
                    }}
                    placeholder="https://example.com/images/spare-part.jpg"
                    className="bg-muted border-border text-xs h-9.5 rounded-xl focus-visible:ring-primary"
                  />
                </div>
              )}

              {/* ========================================================================= */}
              {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING STUDIO                       */}
              {/* ========================================================================= */}
              <div className="space-y-3 p-4 rounded-2xl bg-muted/60 border border-border mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Live Folder Structure Preview
                    </span>
                  </div>

                  {previewUrl && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1">
                        <Move className="w-3 h-3" /> Drag to adjust
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleResetPosition}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2 rounded-lg gap-1"
                        title="Reset position and zoom"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </Button>
                    </div>
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
                <div className="flex justify-center py-1">
                  <div className="relative w-full max-w-[340px] aspect-[3/2] select-none">
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
                        clipPath: `url(#create-folder-clip-${clipId})`,
                        cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                      }}
                      className="relative w-full h-full bg-background overflow-hidden shadow-2xl flex flex-col justify-end border border-border group"
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
                            className="drop-shadow"
                          />
                          {/* Subtle Vignette Gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
                        </div>
                      ) : (
                        /* Default Icon canvas when no thumbnail */
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Folder className="w-7 h-7" />
                          </div>
                        </div>
                      )}

                      {/* 2. Floating Item Count Badge */}
                      <div className="absolute bottom-11 right-2.5 z-20 pointer-events-none">
                        <Badge
                          variant="secondary"
                          className="bg-background/90 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[10px] py-0.5 px-2 font-semibold shadow"
                        >
                          <Package className="w-3 h-3 text-primary" />
                          0 items
                        </Badge>
                      </div>

                      {/* 3. Bottom Glass Bar with Centered Folder Name */}
                      <div className="absolute bottom-0 inset-x-0 z-20 px-3 py-2 bg-background/90 backdrop-blur-md border-t border-border/60 flex items-center justify-center text-center shadow-lg pointer-events-none">
                        <h3 className="text-xs font-extrabold text-foreground tracking-tight truncate w-full text-center">
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
                    <div className="absolute top-6 sm:top-7 right-2 z-40 pointer-events-none">
                      <div className="h-6 w-6 rounded-lg bg-white/90 border border-primary/30 text-primary flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                        <MoreVertical className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Positioning & Zoom Controls (Visible when image is loaded) */}
                {previewUrl && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between text-xs text-foreground">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <ZoomIn className="w-3.5 h-3.5 text-primary" /> Zoom Level: {scale.toFixed(1)}x
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Pan: X: {position.x}px, Y: {position.y}px
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScale((s) => Math.max(1, s - 0.1))}
                        disabled={scale <= 1}
                        className="h-8 w-8 rounded-lg border-border bg-muted text-foreground shrink-0 p-0"
                        title="Zoom out"
                      >
                        <ZoomOut className="w-4 h-4" />
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
                        className="h-8 w-8 rounded-lg border-border bg-muted text-foreground shrink-0 p-0"
                        title="Zoom in"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="text-xs h-9 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="text-xs h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
