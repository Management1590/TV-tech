'use client';

import React, { useState, useTransition, useRef, useId, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
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
  ArrowRight,
  ArrowLeft,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createTvBrandAction } from '@/features/knowledge-base/actions/kb.actions';
import { formatThumbnailUrl } from '@/lib/thumbnail-utils';
import {
  useKeyboardViewport,
  useScrollLock,
  handleProximityTouch,
  createPersistentBlurHandler,
  UnderKeyboardShield,
} from '@/lib/use-keyboard-viewport';

export interface CreateTvBrandDialogProps {
  trigger?: React.ReactNode;
  initialBrandName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTvBrandDialog({
  trigger,
  initialBrandName = '',
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: CreateTvBrandDialogProps = {}) {
  const clipId = useId().replace(/:/g, '');
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialBrandName);
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
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  const { containerStyle, isKeyboardOpen, offsetTop, viewportHeight } = useKeyboardViewport(open);
  useScrollLock(open); // Lock background scroll when sheet is open
  const sheetRef = useRef<HTMLDivElement>(null);

  const persistentBlur = useMemo(
    () => createPersistentBlurHandler(open && step === 1, isPending),
    [open, step, isPending]
  );

  // Smooth focus on brand name input when opening Step 1 (fix keyboard open)
  // When advancing to Step 2 (thumbnail adjustments), explicitly blur to dismiss keyboard
  useEffect(() => {
    if (open && step === 1) {
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus({ preventScroll: true });
        }
      }, 60);
      return () => clearTimeout(timer);
    } else if (open && step === 2) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [open, step]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset step to 1 and sync initialBrandName when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      if (initialBrandName) {
        setName(initialBrandName);
      }
    }
  }, [open, initialBrandName]);

  const handleClose = () => {
    if (isPending) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setOpen(false);
    setTimeout(() => {
      setStep(1);
      setName('');
      setDescription('');
      setLogoUrl('');
      setSelectedFile(null);
      setPreviewUrl(null);
      handleResetPosition();
    }, 240);
  };

  const handleResetPosition = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
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

  const handleCreateBrand = () => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Step 1 NEVER creates brand - it only advances to Step 2 for thumbnail selection
    if (step === 1) {
      if (!name.trim()) {
        toast.error('Please enter a brand name');
        return;
      }
      setStep(2);
      return;
    }

    // Step 2 creates the brand
    handleCreateBrand();
  };

  const cleanName = (name.trim() || 'Brand Name').replace(/_\d{10,}$/, '');

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
          className="h-10 px-4 sm:px-5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer group shrink-0"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Add Brand</span>
        </Button>
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Under-Keyboard Solid Shield: completely covers and hides background elements under the keyboard */}
              <UnderKeyboardShield
                isKeyboardOpen={isKeyboardOpen}
                offsetTop={offsetTop}
                viewportHeight={viewportHeight}
              />

              <div
                className="fixed inset-x-0 z-[110] flex flex-col justify-end items-center select-none"
                style={containerStyle}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClose();
                  }
                }}
              >
                {/* Soft Blurred iOS Backdrop Layer - Fixed to full screen */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 will-change-opacity cursor-pointer touch-none"
                  onClick={(e) => {
                    if (!isPending) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClose();
                    }
                  }}
                />

                {/* iOS Style Bottom Sheet Page */}
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
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      handleClose();
                    }
                  }}
                  ref={sheetRef}
                  style={{
                    maxHeight: '100%',
                    paddingBottom: isKeyboardOpen ? '32px' : undefined,
                    marginBottom: isKeyboardOpen ? '-32px' : undefined,
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    if (step === 1) {
                      handleProximityTouch(e, sheetRef.current);
                    }
                  }}
                >
                {/* Top Drag Indicator Handle */}
                <div
                  onPointerDown={(e) => dragControls.start(e)}
                  className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
                >
                  <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                </div>

                {/* Compact Native Sheet Header */}
                <div
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('button') || target?.closest('a') || target?.closest('input')) return;
                    dragControls.start(e);
                  }}
                  className="px-5 sm:px-6 pt-0.5 pb-2.5 border-b border-border/60 shrink-0 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs shrink-0">
                        <Tv className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground leading-tight truncate">
                            {step === 1 ? 'Add TV Brand' : 'Brand Thumbnail'}
                          </h2>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            ({step}/2)
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-[280px]">
                          {step === 1
                            ? 'Enter brand name and technical notes'
                            : `Position artwork for "${name || 'Brand'}"`}
                        </p>
                      </div>
                    </div>

                    {/* Stepper Dots & Close Button */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            step === 1 ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                          }`}
                        />
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            step === 2 ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                          }`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isPending}
                        className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form & Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Form Content - Non-scrollable in Step 2, smooth scroll in Step 1 */}
                  <div
                    data-modal-scrollable={step === 1 ? 'true' : undefined}
                    className={`flex-1 px-5 sm:px-6 ${
                      step === 2 ? 'py-2 space-y-2 overflow-hidden overscroll-none' : 'py-3 space-y-3 overflow-y-auto no-scrollbar'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {step === 1 ? (
                        <motion.div
                          key="step-1"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-3 py-1"
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor="create-brand-name" className="text-xs font-bold text-foreground flex items-center justify-between">
                              <span>Brand Name *</span>
                              <span className="text-[10px] text-muted-foreground font-normal">Required</span>
                            </Label>
                            <Input
                              id="create-brand-name"
                              ref={nameInputRef}
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              onBlur={persistentBlur}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (name.trim()) {
                                    if (document.activeElement instanceof HTMLElement) {
                                      document.activeElement.blur();
                                    }
                                    setStep(2);
                                  } else {
                                    toast.error('Please enter a brand name');
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
                              className="h-10 sm:h-11 rounded-2xl bg-muted/40 hover:bg-muted/60 focus:bg-white border-border/80 text-sm font-semibold transition-all"
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
                              onBlur={persistentBlur}
                              placeholder="Optional technical guidelines, chassis series, or service remarks..."
                              rows={2}
                              disabled={isPending}
                              className="rounded-2xl bg-muted/40 hover:bg-muted/60 focus:bg-white border-border/80 text-sm transition-all resize-none"
                            />
                          </div>

                          {/* Next Step Teaser Card - Hidden on mobile to ensure 100% visibility of all buttons */}
                          <div className="hidden sm:flex items-center gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
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
                          className="space-y-2.5 py-0.5"
                        >
                          {/* Hidden File Input always mounted so trigger works in both modes */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />

                          {/* Image Selection Strip: Collapsed when image loaded, full selector when empty */}
                          {!previewUrl ? (
                            <div className="space-y-2">
                              {/* Mode Switch Tabs for Logo */}
                              <div className="flex gap-1.5 p-1 bg-muted/70 border border-border/80 rounded-2xl">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={logoMode === 'upload' ? 'default' : 'ghost'}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLogoMode('upload');
                                  }}
                                  className={`flex-1 text-xs h-7.5 rounded-xl font-bold transition-all cursor-pointer ${
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLogoMode('url');
                                  }}
                                  className={`flex-1 text-xs h-7.5 rounded-xl font-bold transition-all cursor-pointer ${
                                    logoMode === 'url'
                                      ? 'bg-primary hover:bg-primary text-primary-foreground shadow-xs'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  <LinkIcon className="w-3.5 h-3.5 mr-1.5" /> Direct URL
                                </Button>
                              </div>

                              {logoMode === 'upload' ? (
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                  }}
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
                                  className="bg-muted/40 border-border/80 text-xs h-9 rounded-xl focus-visible:ring-primary"
                                />
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
                                    {selectedFile ? selectedFile.name : (logoUrl ? 'Direct Image URL' : 'Brand Artwork')}
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (logoMode === 'upload') {
                                      fileInputRef.current?.click();
                                    } else {
                                      setPreviewUrl(null);
                                      setLogoUrl('');
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedFile(null);
                                    setPreviewUrl(null);
                                    setLogoUrl('');
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

                          {/* LIVE FOLDER SILHOUETTE PREVIEW & POSITIONING */}
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
                                    <Move className="w-2.5 h-2.5" /> Drag to adjust
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
                                <clipPath id={`create-brand-clip-${clipId}`} clipPathUnits="objectBoundingBox">
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
                                    clipPath: `url(#create-brand-clip-${clipId})`,
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
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-slate-50/80 to-slate-100/60 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-slate-900/60 flex items-center justify-center overflow-hidden pointer-events-none">
                                      {/* Soft ambient glow */}
                                      <div className="absolute w-40 h-40 rounded-full bg-slate-300/25 dark:bg-slate-700/25 blur-3xl pointer-events-none" />
                                      {/* Geometric pattern */}
                                      <div
                                        className="absolute inset-0 opacity-[0.04]"
                                        style={{
                                          backgroundImage: 'radial-gradient(oklch(0.50 0.05 260) 1px, transparent 1px)',
                                          backgroundSize: '16px 16px',
                                        }}
                                      />
                                      <div className="relative flex flex-col items-center justify-center text-center p-2">
                                        <div className="w-11 h-11 rounded-xl bg-white/95 dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-500 dark:text-slate-400">
                                          <Tv className="w-5 h-5" />
                                        </div>
                                        {description && (
                                          <p className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-1 max-w-[130px] font-medium">
                                            {description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* 2. Floating Model Count Badge - 100% matched to BrandFolderCard */}
                                  <div className="absolute bottom-9 right-2 z-20 pointer-events-none">
                                    <Badge
                                      variant="secondary"
                                      className="bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md gap-1 text-[10px] py-0.5 px-2 font-black shadow-xs"
                                      title="0 Models"
                                    >
                                      <Tv className="w-3 h-3 text-slate-400 dark:text-slate-400 shrink-0" />
                                      <span>0</span>
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

                            {/* Positioning & Zoom Controls */}
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Footer Navigation Buttons with iOS Safe Area Padding */}
                  <div
                    className={`px-5 sm:px-6 pt-2.5 border-t border-border/60 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 ${
                      isKeyboardOpen ? 'pb-3' : 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
                    }`}
                  >
                    {step === 1 ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClose}
                          disabled={isPending}
                          className="rounded-2xl text-xs h-9.5 px-4 cursor-pointer font-medium"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!name.trim()) {
                              toast.error('Please enter a brand name');
                              return;
                            }
                            if (document.activeElement instanceof HTMLElement) {
                              document.activeElement.blur();
                            }
                            setStep(2);
                          }}
                          disabled={!name.trim()}
                          className="rounded-2xl text-xs h-9.5 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
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
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setStep(1);
                          }}
                          disabled={isPending}
                          className="rounded-2xl text-xs h-9.5 px-4 cursor-pointer font-semibold gap-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </Button>
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCreateBrand();
                          }}
                          disabled={isPending || !name.trim()}
                          className="rounded-2xl text-xs h-9.5 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <span>Create Brand Folder</span>
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
