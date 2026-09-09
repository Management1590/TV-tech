'use client';

import React, { useState, useEffect, useTransition, useId, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { IosSlideToConfirm } from '@/components/shared/ios-slide-to-confirm';
import {
  MoreVertical,
  Pencil,
  Trash2,
  ImagePlus,
  FileText,
  Loader2,
  AlertTriangle,
  Tv,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  renameTvBrandAction,
  updateTvBrandDescriptionAction,
  deleteTvBrandAction,
} from '@/features/knowledge-base/actions/kb.actions';
import { SetBrandThumbnailDialog } from './set-brand-thumbnail-dialog';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';
import {
  useKeyboardViewport,
  useScrollLock,
  handleProximityTouch,
  createPersistentBlurHandler,
  UnderKeyboardShield,
} from '@/lib/use-keyboard-viewport';

interface BrandContextMenuProps {
  brandId: string;
  brandName: string;
  entityId: string;
  modelCount: number;
  currentDescription?: string | null;
  currentLogoUrl?: string | null;
  userRole?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDeleteSuccess?: () => void;
}

export function BrandContextMenu({
  brandId,
  brandName,
  entityId,
  modelCount,
  currentDescription,
  currentLogoUrl,
  userRole = 'STAFF',
  isOpen: mobileOpen = false,
  onOpenChange: setMobileOpen = () => {},
  onDeleteSuccess,
}: BrandContextMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const previewClipId = useId().replace(/:/g, '');
  const parsedThumb = parseThumbnailUrl(currentLogoUrl);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [newName, setNewName] = useState(brandName);
  const [newDescription, setNewDescription] = useState(currentDescription || '');
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const deleteDragControls = useDragControls();
  const renameViewport = useKeyboardViewport(isRenameOpen);
  const descViewport = useKeyboardViewport(isDescriptionOpen);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);
  const renameSheetRef = useRef<HTMLDivElement>(null);
  const descSheetRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when mobile menu, delete modal, rename sheet, or description sheet is open
  useScrollLock(mobileOpen || isDeleteOpen || isRenameOpen || isDescriptionOpen);

  const persistentRenameBlur = useMemo(
    () => createPersistentBlurHandler(isRenameOpen, isPending),
    [isRenameOpen, isPending]
  );
  const persistentDescBlur = useMemo(
    () => createPersistentBlurHandler(isDescriptionOpen, isPending),
    [isDescriptionOpen, isPending]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = !!userRole;

  React.useEffect(() => {
    if (isRenameOpen) {
      setNewName(brandName);
      const timer = setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus({ preventScroll: true });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isRenameOpen, brandName]);

  React.useEffect(() => {
    if (isDescriptionOpen) {
      setNewDescription(currentDescription || '');
      const timer = setTimeout(() => {
        if (descTextareaRef.current) {
          descTextareaRef.current.focus({ preventScroll: true });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isDescriptionOpen, currentDescription]);

  const handleCloseRename = () => {
    if (isPending) return;
    if (renameInputRef.current) {
      renameInputRef.current.blur();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsRenameOpen(false);
  };

  const handleCloseDesc = () => {
    if (isPending) return;
    if (descTextareaRef.current) {
      descTextareaRef.current.blur();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsDescriptionOpen(false);
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    startTransition(async () => {
      const res = await renameTvBrandAction(brandId, newName.trim());
      if (res.success) {
        toast.success('Brand renamed successfully');
        setIsRenameOpen(false);
      } else {
        toast.error(res.error || 'Failed to rename brand');
      }
    });
  };

  const handleUpdateDescription = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateTvBrandDescriptionAction(brandId, newDescription);
      if (res.success) {
        toast.success('Brand description updated successfully');
        setIsDescriptionOpen(false);
      } else {
        toast.error(res.error || 'Failed to update description');
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTvBrandAction(brandId);
      if (res.success) {
        toast.success(`Brand "${brandName}" deleted successfully`);
        setIsDeleteOpen(false);
        setMobileOpen(false);
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
        // If the user is currently on this brand's detail page, redirect to brand directory
        if (typeof window !== 'undefined' && window.location.pathname.includes(`/knowledge-base/brands/${brandId}`)) {
          router.replace('/knowledge-base');
        }
      } else {
        toast.error(res.error || 'Failed to delete brand');
      }
    });
  };

  return (
    <>
      {/* Desktop View: Standard Compact Dropdown (Triggers only on 3-dots click on desktop) */}
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Brand options"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="h-7 w-7 inline-flex items-center justify-center rounded-xl bg-white/40 hover:bg-white text-foreground/80 hover:text-primary border border-white/60 hover:border-white shadow-2xs hover:shadow-md backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer z-20 group/menu"
          >
            <MoreVertical className="h-3.5 w-3.5 transition-transform group-hover/menu:scale-110" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 rounded-2xl bg-white border border-border text-foreground shadow-xl p-1.5 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onClick={() => setIsRenameOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-muted"
            >
              <Pencil className="w-3.5 h-3.5 text-primary" />
              <span>Rename Brand</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setIsDescriptionOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-muted"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Edit Description</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setIsThumbnailOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-muted"
            >
              <ImagePlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Change Logo / Thumbnail</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 border-border/60" />

            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Brand</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile View: Authentic iOS Bottom Sheet Page (Unified Folder, Options & Cancel) */}
      {mounted && createPortal(
        <AnimatePresence>
          {mobileOpen && (
            <div
              className="fixed inset-0 z-[100] flex flex-col justify-end sm:hidden select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
                }
              }}
            >
              {/* SVG ClipPath Definition for Preview Brand Folder Silhouette */}
              <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
                <defs>
                  <clipPath id={`preview-brand-folder-clip-${previewClipId}`} clipPathUnits="objectBoundingBox">
                    <path d="M 0.16,1 A 0.16,0.16 0 0,1 0,0.84 L 0,0.14 A 0.14,0.14 0 0,1 0.14,0 L 0.33,0 C 0.40,0 0.41,0.15 0.48,0.15 L 0.86,0.15 A 0.14,0.14 0 0,1 1,0.29 L 1,0.84 A 0.16,0.16 0 0,1 0.84,1 Z" />
                  </clipPath>
                </defs>
              </svg>

              {/* Backdrop Blur Layer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="fixed inset-0 bg-black/45 backdrop-blur-[3px] -z-10 will-change-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
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
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 320) {
                    setMobileOpen(false);
                  }
                }}
                className="relative z-10 w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Drag Indicator Handle */}
                <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                  <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                </div>

                {/* Sheet Scrollable Body with subtle content entrance */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-y-auto px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 no-scrollbar flex flex-col items-center w-full"
                >
                  {/* Authentic Brand Folder Preview Inside Sheet */}
                  <div className="relative w-[175px] h-[155px] my-1 shrink-0 filter drop-shadow-md">
                    <div className="relative w-full h-full flex flex-col">
                      {/* 1. CLIPPED FOLDER BODY & RICH TINTED ARTWORK */}
                      <div
                        className="relative w-full h-full bg-muted overflow-hidden flex flex-col justify-end shadow-md"
                        style={{
                          clipPath: `url(#preview-brand-folder-clip-${previewClipId})`,
                        }}
                      >
                        {/* Background Artwork or Rich Tinted Brand Gradient Canvas */}
                        {parsedThumb.url ? (
                          <div className="absolute inset-0 w-full h-full overflow-hidden bg-muted/80 flex items-center justify-center">
                            <img
                              src={parsedThumb.url}
                              alt={brandName}
                              style={{
                                transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                                transformOrigin: 'center center',
                              }}
                              className="w-full h-full object-cover"
                            />
                            {/* Subtle bottom vignette for text contrast */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-slate-50/80 to-slate-100/60 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-slate-900/60 flex items-center justify-center overflow-hidden">
                            {/* Soft ambient glow */}
                            <div className="absolute w-36 h-36 rounded-full bg-slate-300/25 dark:bg-slate-700/25 blur-2xl pointer-events-none" />
                            {/* Geometric pattern */}
                            <div
                              className="absolute inset-0 opacity-[0.04]"
                              style={{
                                backgroundImage: 'radial-gradient(oklch(0.50 0.05 260) 1px, transparent 1px)',
                                backgroundSize: '14px 14px',
                              }}
                            />
                            <div className="relative flex flex-col items-center justify-center text-center p-2">
                              <div className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-500 dark:text-slate-400 mb-1">
                                <Tv className="w-5 h-5" />
                              </div>
                              {currentDescription && (
                                <p className="text-[9px] text-muted-foreground/80 line-clamp-1 max-w-[125px] font-medium">
                                  {currentDescription}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. FLOATING MODEL COUNT BADGE */}
                        <div className="absolute bottom-9 right-1.5 z-20">
                          <Badge
                            variant="secondary"
                            className="bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md gap-1 text-[9px] py-0.5 px-2 font-black shadow-xs"
                            title={`${modelCount} ${modelCount === 1 ? 'Model' : 'Models'}`}
                          >
                            <Tv className="w-2.5 h-2.5 text-slate-400 dark:text-slate-400 shrink-0" />
                            <span>{modelCount}</span>
                          </Badge>
                        </div>

                        {/* 3. FROSTED GLASS FOOTER BAR */}
                        <div className="relative z-10 px-2 py-1.5 bg-white/95 backdrop-blur-md border-t border-border/80 flex items-center justify-center text-center shadow-sm">
                          <h3
                            className="font-bold text-foreground text-xs tracking-tight truncate leading-tight w-full text-center"
                            title={brandName}
                          >
                            {brandName}
                          </h3>
                        </div>
                      </div>

                      {/* 4. CLEAN PERIMETER BORDER CONTOUR */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
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

                  {/* Actions Group Card */}
                  <div className="w-full bg-muted/40 dark:bg-slate-800/40 rounded-2xl border border-border/60 p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsRenameOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-white dark:hover:bg-slate-700/80 active:bg-white dark:active:bg-slate-700 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Rename Brand</div>
                        <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Change manufacturer name</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsDescriptionOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-white dark:hover:bg-slate-700/80 active:bg-white dark:active:bg-slate-700 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Edit Description</div>
                        <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Update brand overview</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsThumbnailOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-white dark:hover:bg-slate-700/80 active:bg-white dark:active:bg-slate-700 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                        <ImagePlus className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Change Logo / Thumbnail</div>
                        <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Upload brand logo artwork</div>
                      </div>
                    </button>

                    <div className="border-t border-border/50 my-1 mx-1" />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsDeleteOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800/50 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-red-600 font-bold text-xs sm:text-sm">Delete Brand</div>
                        <div className="text-[10px] sm:text-[11px] font-normal text-red-400 truncate">Remove brand & its models</div>
                      </div>
                    </button>
                  </div>

                  {/* iOS Style Pill Cancel Button INSIDE the same bottom sheet page */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileOpen(false);
                    }}
                    className="w-full h-12 rounded-full border border-border/80 bg-white dark:bg-slate-800 hover:bg-muted active:bg-muted/80 text-foreground font-semibold text-sm shadow-2xs active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
                  >
                    Cancel
                  </button>
                </motion.div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 1. RENAME BRAND IOS BOTTOM SHEET ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {isRenameOpen && (
            <>
              {/* Under-Keyboard Solid Shield: completely covers and hides background elements under the keyboard */}
              <UnderKeyboardShield
                isKeyboardOpen={renameViewport.isKeyboardOpen}
                offsetTop={renameViewport.offsetTop}
                viewportHeight={renameViewport.viewportHeight}
              />

              <div
                className="fixed inset-x-0 z-[110] flex flex-col justify-end items-center select-none"
                style={renameViewport.containerStyle}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    handleCloseRename();
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer touch-none"
                  onClick={() => {
                    if (!isPending) handleCloseRename();
                  }}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
                  transition={{ type: 'spring', damping: 30, stiffness: 340, mass: 0.8 }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.2 }}
                  onDragEnd={(_, info) => {
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      handleCloseRename();
                    }
                  }}
                  ref={renameSheetRef}
                  style={{
                    maxHeight: '100%',
                    paddingBottom: renameViewport.isKeyboardOpen ? '32px' : undefined,
                    marginBottom: renameViewport.isKeyboardOpen ? '-32px' : undefined,
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => handleProximityTouch(e, renameSheetRef.current)}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground">Rename Brand</h2>
                        <p className="text-[11px] text-muted-foreground">Update the manufacturer display name</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseRename}
                      disabled={isPending}
                      className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleRename} className="flex flex-col flex-1 min-h-0">
                    <div className="p-5 sm:p-6 space-y-3">
                      <Label className="text-xs font-bold text-foreground">Brand Name</Label>
                      <Input
                        ref={renameInputRef}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={persistentRenameBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newName.trim() && newName.trim() !== brandName) {
                              handleRename(e);
                            }
                          }
                        }}
                        required
                        className="h-11 rounded-2xl bg-muted/40 hover:bg-muted/60 focus:bg-white border-border/80 text-sm font-semibold"
                        autoFocus
                      />
                    </div>

                    <div
                      className={`px-5 sm:px-6 pt-3 border-t border-border/60 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 ${
                        renameViewport.isKeyboardOpen ? 'pb-3' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseRename}
                        className="rounded-2xl text-xs h-10 px-4 cursor-pointer font-medium"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending || !newName.trim() || newName.trim() === brandName}
                        className="rounded-2xl text-xs h-10 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary text-white font-bold gap-2 cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 2. EDIT DESCRIPTION IOS BOTTOM SHEET ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {isDescriptionOpen && (
            <>
              {/* Under-Keyboard Solid Shield: completely covers and hides background elements under the keyboard */}
              <UnderKeyboardShield
                isKeyboardOpen={descViewport.isKeyboardOpen}
                offsetTop={descViewport.offsetTop}
                viewportHeight={descViewport.viewportHeight}
              />

              <div
                className="fixed inset-x-0 z-[110] flex flex-col justify-end items-center select-none"
                style={descViewport.containerStyle}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    handleCloseDesc();
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer touch-none"
                  onClick={() => {
                    if (!isPending) handleCloseDesc();
                  }}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
                  transition={{ type: 'spring', damping: 30, stiffness: 340, mass: 0.8 }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.2 }}
                  onDragEnd={(_, info) => {
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      handleCloseDesc();
                    }
                  }}
                  ref={descSheetRef}
                  style={{
                    maxHeight: '100%',
                    paddingBottom: descViewport.isKeyboardOpen ? '32px' : undefined,
                    marginBottom: descViewport.isKeyboardOpen ? '-32px' : undefined,
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => handleProximityTouch(e, descSheetRef.current)}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground">Edit Brand Description</h2>
                        <p className="text-[11px] text-muted-foreground">Technical guidelines & overview for {brandName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseDesc}
                      disabled={isPending}
                      className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleUpdateDescription} className="flex flex-col flex-1 min-h-0">
                    <div className="p-5 sm:p-6 space-y-3">
                      <Label className="text-xs font-bold text-foreground">Description / Notes</Label>
                      <Textarea
                        ref={descTextareaRef}
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        onBlur={persistentDescBlur}
                        placeholder="Optional technical guidelines, chassis series, or service remarks..."
                        rows={3}
                        className="rounded-2xl bg-muted/40 hover:bg-muted/60 focus:bg-white border-border/80 text-sm transition-all resize-none"
                        autoFocus
                      />
                    </div>

                    <div
                      className={`px-5 sm:px-6 pt-3 border-t border-border/60 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 ${
                        descViewport.isKeyboardOpen ? 'pb-3' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseDesc}
                        className="rounded-2xl text-xs h-10 px-4 cursor-pointer font-medium"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="rounded-2xl text-xs h-10 px-5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold gap-2 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Description
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 3. INTERACTIVE DRAG-TO-ADJUST THUMBNAIL DIALOG ── */}
      <SetBrandThumbnailDialog
        brandId={brandId}
        brandName={brandName}
        currentLogoUrl={currentLogoUrl}
        currentDescription={currentDescription}
        modelCount={modelCount}
        open={isThumbnailOpen}
        onOpenChange={setIsThumbnailOpen}
      />

      {/* ── 4. DELETE BRAND WARNING IOS BOTTOM SHEET ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {isDeleteOpen && (
            <div
              className="fixed inset-0 z-[110] flex flex-col justify-end items-center select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget && !isPending) {
                  setIsDeleteOpen(false);
                }
              }}
            >
              {/* iOS Soft Backdrop with Deep Blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md -z-10 cursor-pointer touch-none"
                onClick={() => {
                  if (!isPending) setIsDeleteOpen(false);
                }}
              />

              {/* iOS Style Bottom Sheet Page */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
                transition={{ type: 'spring', damping: 30, stiffness: 340, mass: 0.8 }}
                drag="y"
                dragControls={deleteDragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={(_, info) => {
                  if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                    setIsDeleteOpen(false);
                  }
                }}
                className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu select-text"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Drag Indicator Handle */}
                <div
                  onPointerDown={(e) => deleteDragControls.start(e)}
                  className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
                >
                  <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                </div>

                {/* Compact Native Sheet Header */}
                <div
                  onPointerDown={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target?.closest('button') || target?.closest('a')) return;
                    deleteDragControls.start(e);
                  }}
                  className="px-5 sm:px-6 pt-0.5 pb-3 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800/50 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-red-600 leading-tight">Delete Brand Folder</h2>
                      <p className="text-[11px] sm:text-xs text-muted-foreground">Permanent removal from Knowledge Base</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isPending}
                    className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:px-6 space-y-3.5 flex-1 overflow-y-auto no-scrollbar">
                  {/* Brand Item Preview Card */}
                  <div className="p-3.5 bg-muted/40 border border-border/70 rounded-2xl flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-border/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      {currentLogoUrl ? (
                        (() => {
                          const { url, scale, x, y } = parseThumbnailUrl(currentLogoUrl);
                          return (
                            <img
                              src={url}
                              alt={brandName}
                              className="w-full h-full object-cover transition-transform"
                              style={{
                                transform: `translate(${x}%, ${y}%) scale(${scale})`,
                              }}
                            />
                          );
                        })()
                      ) : (
                        <Tv className="w-6 h-6 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                        {brandName}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={modelCount > 0 ? 'outline' : 'secondary'}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            modelCount > 0
                              ? 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {modelCount} {modelCount === 1 ? 'Model' : 'Models'} Attached
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Warning / Explanation Alert */}
                  {modelCount > 0 ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        Deletion Blocked: Brand Contains {modelCount} Model(s)
                      </div>
                      <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                        As per system safety rules, you cannot delete a brand folder that still contains registered TV models. Please open this brand and delete or move all inside models first.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-red-900 dark:text-red-300 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        Permanent Action
                      </div>
                      <p className="text-[11px] sm:text-xs text-red-800 dark:text-red-400 leading-relaxed">
                        This brand folder is empty (0 models). Deleting it will permanently remove the brand category from the TV Knowledge Base. This action cannot be undone.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with iOS Slide to Delete & Cancel */}
                <div className="px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-white/95 dark:bg-slate-900/95 flex flex-col gap-2.5 shrink-0">
                  <IosSlideToConfirm
                    onConfirm={handleDelete}
                    isLoading={isPending}
                    disabled={modelCount > 0}
                    disabledReason="Cannot Delete: Models Exist"
                    label="slide to delete brand"
                    loadingLabel="Deleting Brand..."
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isPending}
                    className="w-full h-10 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
