'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ImagePlus,
  Link as LinkIcon,
  Trash2,
  Loader2,
  UploadCloud,
  Package,
  Check,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  MapPin,
  Tag,
  Images,
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
import { setItemThumbnailAction } from '@/features/inventory/actions/item.actions';
import { parseThumbnailUrl, formatThumbnailUrl } from '@/lib/thumbnail-utils';

export interface ExistingMediaOption {
  id: string;
  url: string;
  secureUrl?: string | null;
  filename?: string | null;
  mediaType?: string;
  purpose?: string;
}

interface SetItemThumbnailDialogProps {
  itemId: string;
  itemName: string;
  currentThumbnailUrl?: string | null;
  folderName?: string;
  existingMedia?: ExistingMediaOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThumbnailUpdated?: (url: string | null) => void;
}

export function SetItemThumbnailDialog({
  itemId,
  itemName,
  currentThumbnailUrl,
  folderName,
  existingMedia = [],
  open,
  onOpenChange,
  onThumbnailUpdated,
}: SetItemThumbnailDialogProps) {
  const router = useRouter();

  const [mode, setMode] = useState<'media' | 'upload' | 'url'>(
    existingMedia.length > 0 ? 'media' : 'upload'
  );
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(currentThumbnailUrl || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentThumbnailUrl || null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Natural image aspect ratio (width / height)
  const [imageAspect, setImageAspect] = useState<number | null>(null);

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

  // Sync with current thumbnail on open (Lossless original URL + saved pan/zoom restore)
  useEffect(() => {
    if (open) {
      const parsed = parseThumbnailUrl(currentThumbnailUrl);
      setThumbnailUrl(parsed.url);
      setPreviewUrl(parsed.url || null);
      setScale(parsed.scale);
      setPosition({ x: parsed.x, y: parsed.y });
      setImageAspect(null);
      if (existingMedia.length > 0 && !currentThumbnailUrl) {
        setMode('media');
      }
    }
  }, [open, currentThumbnailUrl, existingMedia.length]);

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

  const selectExistingMedia = (media: ExistingMediaOption) => {
    const url = media.secureUrl || media.url;
    setPreviewUrl(url);
    setThumbnailUrl(url);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setImageAspect(null);
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
      x: Math.round(dragStartRef.current.initX + deltaX),
      y: Math.round(dragStartRef.current.initY + deltaY),
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
      x: Math.round(dragStartRef.current.initX + deltaX),
      y: Math.round(dragStartRef.current.initY + deltaY),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleResetPosition = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Export cropped / positioned image on save
  const handleSave = () => {
    if (!previewUrl) {
      // Remove thumbnail
      startTransition(async () => {
        const res = await setItemThumbnailAction(itemId, null);
        if (res.success) {
          toast.success(`Primary thumbnail removed for "${itemName}"`);
          onThumbnailUpdated?.(null);
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
      const res = await setItemThumbnailAction(itemId, finalUrl || null);
      if (res.success) {
        toast.success(`Primary thumbnail updated for "${itemName}"`);
        onThumbnailUpdated?.(res.primaryUrl || finalUrl);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update item thumbnail');
      }
    });
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setThumbnailUrl('');
    handleResetPosition();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Compute full uncropped image positioning style
  // Standard card header container aspect is 16/10 = 1.6
  const containerAspect = 1.6;
  let imageStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
    maxWidth: 'none',
    maxHeight: 'none',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  if (imageAspect) {
    if (imageAspect > containerAspect) {
      // Wide image: height fills 100%, width expands naturally to full aspect
      imageStyle.height = '100%';
      imageStyle.width = `${(imageAspect / containerAspect) * 100}%`;
    } else {
      // Tall / Square image: width fills 100%, height expands naturally to full aspect
      imageStyle.width = '100%';
      imageStyle.height = `${(containerAspect / imageAspect) * 100}%`;
    }
  } else {
    imageStyle.width = '100%';
    imageStyle.height = '100%';
    imageStyle.objectFit = 'cover';
  }

  const imageMediaList = existingMedia.filter(
    (m) => !m.mediaType || m.mediaType === 'IMAGE'
  );

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto bg-white/95 border-border text-foreground backdrop-blur-2xl p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ImagePlus className="w-4 h-4" />
            </div>
            Adjust Item Thumbnail & Live Card Studio
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Position, drag, and zoom the full primary photo for{' '}
            <span className="text-primary font-semibold">"{itemName}"</span> with real-time card framing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode Switch Tabs */}
          <div className="flex gap-2 p-1 bg-muted border border-border rounded-xl">
            {imageMediaList.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant={mode === 'media' ? 'default' : 'ghost'}
                onClick={() => setMode('media')}
                className={`flex-1 text-xs h-8 rounded-lg font-semibold transition-all ${
                  mode === 'media'
                    ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Images className="w-3.5 h-3.5 mr-1.5" /> Item Media ({imageMediaList.length})
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={mode === 'upload' ? 'default' : 'ghost'}
              onClick={() => setMode('upload')}
              className={`flex-1 text-xs h-8 rounded-lg font-semibold transition-all ${
                mode === 'upload'
                  ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
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
                  ? 'bg-primary hover:bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Image URL
            </Button>
          </div>

          {/* Mode 1: Existing Item Media Selector */}
          {mode === 'media' && imageMediaList.length > 0 && (
            <div className="space-y-2 p-3 bg-slate-50/90 border border-border rounded-xl">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Select from existing uploaded photos:</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Click an image to load full uncropped source
                </span>
              </Label>
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5">
                {imageMediaList.map((m) => {
                  const url = m.secureUrl || m.url;
                  const isSelected = previewUrl === url;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectExistingMedia(m)}
                      className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-sm'
                          : 'border-border/80 hover:border-primary/50 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={url}
                        alt={m.filename || 'Media'}
                        className="w-full h-full object-cover"
                      />
                      {m.purpose === 'PRIMARY' && (
                        <span className="absolute bottom-0.5 right-0.5 bg-primary text-white text-[8px] font-bold px-1 rounded">
                          Primary
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode 2: Upload File */}
          {mode === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="item-thumbnail-upload"
              />
              <label
                htmlFor="item-thumbnail-upload"
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border hover:border-primary/50 rounded-2xl cursor-pointer bg-slate-50/60 hover:bg-slate-50 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">Click or drag full image file here</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Loads full uncropped image for pan and zoom</p>
              </label>
            </div>
          )}

          {/* Mode 3: Image URL */}
          {mode === 'url' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Direct Image URL</Label>
              <Input
                value={thumbnailUrl}
                onChange={(e) => {
                  setThumbnailUrl(e.target.value);
                  setPreviewUrl(e.target.value.trim() || null);
                  handleResetPosition();
                  setImageAspect(null);
                }}
                placeholder="https://example.com/images/part-photo.jpg"
                className="bg-white border-border text-xs h-9.5 rounded-xl focus-visible:ring-primary"
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* LIVE ITEM CARD PREVIEW & FULL IMAGE POSITIONING STUDIO                    */}
          {/* ========================================================================= */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Live Item Card Preview (16:10 Frame)
                </span>
              </div>

              {previewUrl && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 font-semibold">
                    <Move className="w-3 h-3" /> Drag to adjust
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleResetPosition}
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2 rounded-lg gap-1 cursor-pointer"
                    title="Reset position and zoom"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                </div>
              )}
            </div>

            {/* Item Card Live Preview Container */}
            <div className="flex justify-center py-1">
              <div className="w-full max-w-[340px] select-none">
                <div className="glass-card overflow-hidden rounded-2xl border border-border/90 bg-slate-50/70 shadow-lg flex flex-col justify-between">
                  {/* 1. SEAMLESS TOP THUMBNAIL (Full Uncropped Image Canvas) */}
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
                      cursor: previewUrl ? (isDragging ? 'grabbing' : 'grab') : 'default',
                    }}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-slate-200/80 border-b border-border/70 rounded-t-2xl flex items-center justify-center group select-none"
                  >
                    {previewUrl ? (
                      <>
                        <img
                          ref={imageRef}
                          src={previewUrl}
                          alt={itemName}
                          onLoad={handleImageLoaded}
                          draggable={false}
                          style={imageStyle}
                          className="drop-shadow"
                        />
                        {/* Drag overlay guide on hover */}
                        <div className="absolute inset-0 border-2 border-dashed border-primary/20 pointer-events-none rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      </>
                    ) : (
                      /* Default Icon canvas when no thumbnail */
                      <div className="aspect-[16/10] w-full bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-slate-100/90 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-xl bg-white/90 border border-primary/20 flex items-center justify-center shadow-sm">
                          <Package className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. CARD CONTENT DETAILS */}
                  <div className="p-3.5 space-y-2 bg-white/95">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-xs text-foreground line-clamp-1">
                        {itemName}
                      </h3>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 font-medium">
                        In stock
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="h-3 w-3 text-muted-foreground" /> Shelf A1
                      </span>
                      <span className="flex items-center gap-1 font-mono text-primary bg-primary/10 px-1 py-0.2 rounded text-[10px] font-bold border border-primary/20">
                        <Tag className="h-2.5 w-2.5 text-primary" /> #DEMO
                      </span>
                    </div>
                  </div>

                  {/* 3. CARD FOOTER */}
                  {folderName && (
                    <div className="px-3.5 py-2 bg-slate-100/90 border-t border-border/80 text-[10px] text-muted-foreground font-semibold rounded-b-2xl">
                      Category: {folderName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Positioning & Zoom Controls (Visible when image is loaded) */}
            {previewUrl && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between text-xs text-foreground">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <ZoomIn className="w-3.5 h-3.5 text-primary" /> Zoom: {scale.toFixed(2)}x
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Offset: X: {position.x}px, Y: {position.y}px
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))))}
                    disabled={scale <= 0.6}
                    className="h-8 w-8 rounded-lg border-border bg-white text-foreground shrink-0 p-0 shadow-2xs cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>

                  <input
                    type="range"
                    min="0.6"
                    max="3.5"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="flex-1 accent-primary cursor-pointer h-1.5 bg-muted rounded-lg"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScale((s) => Math.min(3.5, Number((s + 0.1).toFixed(2))))}
                    disabled={scale >= 3.5}
                    className="h-8 w-8 rounded-lg border-border bg-white text-foreground shrink-0 p-0 shadow-2xs cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                  💡 <strong>Click & drag</strong> on the photo to position any part of the full image
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7 gap-1 cursor-pointer"
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
            className="text-xs text-muted-foreground hover:text-foreground h-9 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-5 rounded-xl font-bold shadow-md shadow-primary/20 gap-1.5 cursor-pointer"
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
