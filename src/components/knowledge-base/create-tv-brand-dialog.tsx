'use client';

import React, { useState, useTransition, useRef, useId } from 'react';
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
    if (!name.trim()) return;

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

      <Dialog open={open} onOpenChange={isPending ? undefined : setOpen}>
        <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto bg-white/95 border-border text-foreground backdrop-blur-2xl p-6 shadow-2xl rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Tv className="w-4 h-4" />
                </div>
                Add TV Brand & Thumbnail
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Create a manufacturer category with live drag-to-adjust thumbnail preview.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="create-brand-name" className="text-xs font-semibold text-foreground">
                  Brand Name *
                </Label>
                <Input
                  id="create-brand-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Samsung, LG, Sony, TCL"
                  required
                  autoFocus
                  disabled={isPending}
                  className="h-11 rounded-xl bg-muted/50 border-border/80 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-brand-desc" className="text-xs font-semibold text-foreground">
                  Description / Technical Notes (Optional)
                </Label>
                <Textarea
                  id="create-brand-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Major Korean manufacturer, panel voltage guidelines, common chassis..."
                  rows={2}
                  disabled={isPending}
                  className="rounded-xl bg-muted/50 border-border/80 text-sm"
                />
              </div>

              {/* Mode Switch Tabs for Logo */}
              <div className="space-y-2 pt-1">
                <div className="flex gap-2 p-1 bg-muted border border-border rounded-xl">
                  <Button
                    type="button"
                    size="sm"
                    variant={logoMode === 'upload' ? 'default' : 'ghost'}
                    onClick={() => setLogoMode('upload')}
                    className={`flex-1 text-xs h-7 rounded-lg font-semibold transition-all ${
                      logoMode === 'upload'
                        ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
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
                    className={`flex-1 text-xs h-7 rounded-lg font-semibold transition-all ${
                      logoMode === 'url'
                        ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
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
                      className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 cursor-pointer bg-muted/40 hover:bg-muted/80 transition-all text-center group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                        <UploadCloud className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Click or drag image file here</span>
                      <span className="text-[10px] text-muted-foreground">Supports high-resolution PNG, JPG, WebP</span>
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
                    placeholder="https://example.com/images/brand-photo.jpg"
                    className="bg-muted border-border text-xs h-9.5 rounded-xl focus-visible:ring-primary"
                  />
                )}
              </div>

              {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING STUDIO (Exact match) */}
              <div className="space-y-3 p-4 rounded-2xl bg-muted/60 border border-border">
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
                    <clipPath id={`create-brand-clip-${clipId}`} clipPathUnits="objectBoundingBox">
                      <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
                    </clipPath>
                  </defs>
                </svg>

                {/* Folder Silhouette Preview Canvas Container - Centered aspect-[3/2] box */}
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
                        clipPath: `url(#create-brand-clip-${clipId})`,
                        cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                      }}
                      className="relative w-full h-full bg-background overflow-hidden shadow-2xl flex flex-col justify-end border border-border group"
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
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Tv className="w-7 h-7" />
                          </div>
                        </div>
                      )}

                      {/* 2. Floating Model Count Badge */}
                      <div className="absolute bottom-11 right-2.5 z-20 pointer-events-none">
                        <Badge
                          variant="secondary"
                          className="bg-background/90 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[10px] py-0.5 px-2 font-semibold shadow"
                        >
                          <Tv className="w-3 h-3 text-primary" />
                          0 Models
                        </Badge>
                      </div>

                      {/* 3. Bottom Glass Bar with Centered Brand Name */}
                      <div className="absolute bottom-0 inset-x-0 z-20 px-3 py-2 bg-background/90 backdrop-blur-md border-t border-border/60 flex items-center justify-center text-center shadow-lg pointer-events-none">
                        <h3 className="text-xs font-extrabold text-foreground tracking-tight truncate w-full text-center">
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
                    <div className="absolute top-6 sm:top-7 right-2 z-40 pointer-events-none">
                      <div className="h-6 w-6 rounded-lg bg-white/90 border border-primary/30 text-primary flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                        <MoreVertical className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Positioning & Zoom Controls */}
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

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !name.trim()}
                className="rounded-xl text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-sm"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Brand Folder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
