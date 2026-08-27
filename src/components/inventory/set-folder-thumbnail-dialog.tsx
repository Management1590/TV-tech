'use client';

import React, { useState, useTransition, useRef, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import {
  ImagePlus,
  Link as LinkIcon,
  Trash2,
  Loader2,
  UploadCloud,
  Folder,
  Check,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Package,
  MoreVertical,
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
import { updateFolderThumbnailAction } from '@/features/inventory/actions/folder.actions';
import { parseThumbnailUrl, formatThumbnailUrl } from '@/lib/thumbnail-utils';

interface SetFolderThumbnailDialogProps {
  folderId: string;
  folderName: string;
  currentThumbnailUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetFolderThumbnailDialog({
  folderId,
  folderName,
  currentThumbnailUrl,
  open,
  onOpenChange,
}: SetFolderThumbnailDialogProps) {
  const router = useRouter();
  const clipId = useId().replace(/:/g, '');

  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(currentThumbnailUrl || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentThumbnailUrl || null);
  const [isPending, startTransition] = useTransition();
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

  // Natural image aspect ratio (width / height)
  const [imageAspect, setImageAspect] = useState<number | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sync with current thumbnail on open (Lossless original URL + saved pan/zoom restore)
  useEffect(() => {
    if (open) {
      const parsed = parseThumbnailUrl(currentThumbnailUrl);
      setThumbnailUrl(parsed.url);
      setPreviewUrl(parsed.url || null);
      setScale(parsed.scale);
      setPosition({ x: parsed.x, y: parsed.y });
      setImageAspect(null);
    }
  }, [open, currentThumbnailUrl]);

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

  // Lossless save: preserve original image file and store pan/zoom offsets
  const handleSave = () => {
    if (!previewUrl) {
      // Remove thumbnail
      startTransition(async () => {
        const res = await updateFolderThumbnailAction(folderId, null);
        if (res.success) {
          toast.success(`Thumbnail removed for "${folderName}"`);
          onOpenChange(false);
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to update thumbnail');
        }
      });
      return;
    }

    startTransition(async () => {
      const finalUrl = formatThumbnailUrl(thumbnailUrl || previewUrl, position.x, position.y, scale);
      const res = await updateFolderThumbnailAction(folderId, finalUrl || null);
      if (res.success) {
        toast.success(`Thumbnail updated for "${folderName}"`);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update folder thumbnail');
      }
    });
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setThumbnailUrl('');
    handleResetPosition();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[88dvh] sm:max-h-[92vh] overflow-y-auto bg-white/95 border-border text-foreground backdrop-blur-2xl p-4 sm:p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1 pb-2 sm:pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <ImagePlus className="w-4 h-4" />
            </div>
            Set Folder Thumbnail & Silhouette
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground">
            Upload a photo and adjust its position inside the real folder silhouette for{' '}
            <span className="text-primary font-semibold">"{folderName}"</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2">
          {/* Mode Switch Tabs */}
          <div className="flex gap-2 p-1 bg-muted border border-border rounded-xl">
            <Button
              type="button"
              size="sm"
              variant={mode === 'upload' ? 'default' : 'ghost'}
              onClick={() => setMode('upload')}
              className={`flex-1 text-xs h-8 rounded-lg font-semibold transition-all ${
                mode === 'upload'
                  ? 'bg-primary hover:bg-primary text-foreground shadow-sm'
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
              className={`flex-1 text-xs h-8 rounded-lg font-semibold transition-all ${
                mode === 'url'
                  ? 'bg-primary hover:bg-primary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Image URL
            </Button>
          </div>

          {/* Upload Input */}
          {mode === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="folder-thumbnail-upload"
              />
              <label
                htmlFor="folder-thumbnail-upload"
                className="flex flex-col items-center justify-center p-3 sm:p-5 border-2 border-dashed border-border hover:border-blue-500/50 rounded-2xl cursor-pointer bg-muted/40 hover:bg-muted/80 transition-all text-center group"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">Click or drag image file here</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Supports high-resolution PNG, JPG, WebP</p>
              </label>
            </div>
          )}

          {/* URL Input */}
          {mode === 'url' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Direct Image URL</Label>
              <Input
                value={thumbnailUrl}
                onChange={(e) => {
                  setThumbnailUrl(e.target.value);
                  setPreviewUrl(e.target.value.trim() || null);
                  handleResetPosition();
                }}
                placeholder="https://example.com/images/spare-part.jpg"
                className="bg-muted border-border text-xs h-9 rounded-xl focus-visible:ring-primary"
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING STUDIO                       */}
          {/* ========================================================================= */}
          <div className="space-y-2.5 sm:space-y-3 p-2.5 sm:p-4 rounded-2xl bg-muted/60 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] sm:text-xs font-bold text-foreground uppercase tracking-wider">
                  Live Preview
                </span>
              </div>

              {previewUrl && (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 px-1.5 py-0">
                    <Move className="w-2.5 h-2.5" /> Drag to pan
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleResetPosition}
                    className="h-6 text-[10px] sm:text-[11px] text-muted-foreground hover:text-foreground px-1.5 rounded-lg gap-1"
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
                <clipPath id={`dialog-folder-clip-${clipId}`} clipPathUnits="objectBoundingBox">
                  <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
                </clipPath>
              </defs>
            </svg>

            {/* Folder Silhouette Preview Canvas Container */}
            <div className="flex justify-center py-0.5">
              <div className="relative w-full max-w-[240px] sm:max-w-[340px] aspect-[3/2] select-none">
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
                    clipPath: `url(#dialog-folder-clip-${clipId})`,
                    cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  }}
                  className="relative w-full h-full bg-background overflow-hidden shadow-xl flex flex-col justify-end border border-border group"
                >
                  {previewUrl ? (
                    <div className="absolute inset-0 w-full h-full overflow-hidden bg-background flex items-center justify-center">
                      <img
                        ref={imageRef}
                        src={previewUrl}
                        alt={folderName}
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
                      12 items
                    </Badge>
                  </div>

                  {/* 3. Bottom Glass Bar with Centered Folder Name */}
                  <div className="absolute bottom-0 inset-x-0 z-20 px-3 py-2 bg-background/90 backdrop-blur-md border-t border-border/60 flex items-center justify-center text-center shadow-lg pointer-events-none">
                    <h3 className="text-xs font-extrabold text-foreground tracking-tight truncate w-full text-center">
                      {folderName}
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
                    <linearGradient id={`dialog-neonGrad-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                      <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 6,100 A 6,8 0 0,1 0,92 L 0,8 A 6,8 0 0,1 6,0 L 30,0 C 34,0 33,13.5 37,13.5 L 94,13.5 A 6,8 0 0,1 100,21.5 L 100,92 A 6,8 0 0,1 94,100 Z"
                    fill="none"
                    stroke={`url(#dialog-neonGrad-${clipId})`}
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
                    className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-muted rounded-lg"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                    disabled={scale >= 3}
                    className="h-8 w-8 rounded-lg border-border bg-muted text-foreground shrink-0 p-0"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                  💡 <strong>Click & drag</strong> directly on the folder preview to position the photo
                </p>
              </div>
            )}

            {/* Remove button */}
            {previewUrl && (
              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemove}
                  className="text-red-600 hover:text-red-300 hover:bg-red-50 text-xs h-7 gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Thumbnail
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 pt-4 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-primary hover:bg-primary text-foreground text-xs h-9 px-5 rounded-xl font-bold shadow-[0_0_20px_rgba(59,130,246,0.35)] gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving Thumbnail...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Save & Apply Thumbnail
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
