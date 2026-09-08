'use client';

import React, { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { IosSlideToConfirm } from '@/components/shared/ios-slide-to-confirm';
import {
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Monitor,
  CheckCircle2,
  ArrowRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  renameTvModelAction,
  deleteTvModelAction,
} from '@/features/knowledge-base/actions/kb.actions';
import { validateNameSimilarity } from '@/features/knowledge-base/utils/name-similarity-validator';
import {
  useKeyboardViewport,
  useScrollLock,
  handleProximityTouch,
  createPersistentBlurHandler,
  UnderKeyboardShield,
} from '@/lib/use-keyboard-viewport';

interface ModelContextMenuProps {
  modelId: string;
  modelNumber: string;
  brandId?: string;
  screenSize?: number | null;
  brandName?: string;
  folderCount?: number;
  userRole?: string;
  existingModels?: string[];
  onDeleteSuccess?: () => void;
}

export function ModelContextMenu({
  modelId,
  modelNumber,
  brandId,
  screenSize,
  brandName,
  folderCount = 0,
  userRole = 'STAFF',
  existingModels = [],
  onDeleteSuccess,
}: ModelContextMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteDragControls = useDragControls();

  const renameViewport = useKeyboardViewport(isRenameOpen);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameSheetRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when mobile menu, delete modal, or rename sheet is open
  useScrollLock(mobileOpen || isDeleteOpen || isRenameOpen);

  const [isPending, startTransition] = useTransition();

  const persistentRenameBlur = useMemo(
    () => createPersistentBlurHandler(isRenameOpen, isPending),
    [isRenameOpen, isPending]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const [newModelNumber, setNewModelNumber] = useState(modelNumber);
  const [newScreenSize, setNewScreenSize] = useState(screenSize ? String(screenSize) : '');
  const [autoDetectedSize, setAutoDetectedSize] = useState<string | null>(null);
  const isAdmin = !!userRole;

  // Filter out current model number from collision comparison
  const otherModels = useMemo(() => {
    return (existingModels || []).filter(
      (m) => m.trim().toUpperCase() !== modelNumber.trim().toUpperCase()
    );
  }, [existingModels, modelNumber]);

  // Real-time duplicate & similarity checking
  const similarityResult = useMemo(() => {
    if (!newModelNumber.trim() || otherModels.length === 0) {
      return { level: 'NONE' as const, hasConflict: false, hasWarning: false };
    }
    return validateNameSimilarity(newModelNumber, otherModels, 'Model');
  }, [newModelNumber, otherModels]);

  const handleCloseRename = () => {
    if (isPending) return;
    if (renameInputRef.current) {
      renameInputRef.current.blur();
    }
    const sizeInput = document.getElementById('rename-screen-size');
    if (sizeInput instanceof HTMLElement) {
      sizeInput.blur();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsRenameOpen(false);
  };

  React.useEffect(() => {
    if (isRenameOpen) {
      setNewModelNumber(modelNumber);
      setNewScreenSize(screenSize ? String(screenSize) : '');
      setAutoDetectedSize(null);
      const timer = setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus({ preventScroll: true });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isRenameOpen, modelNumber, screenSize]);

  // Auto-detect starting 2 numeric digits when renaming model number
  const handleModelNumberChange = (value: string) => {
    setNewModelNumber(value);

    const cleaned = value.trim();
    const match = cleaned.match(/^(\d{2})/) || cleaned.match(/(?:^[a-zA-Z]{0,4}[-_]?)(\d{2})/);

    if (match && match[1]) {
      const detected = match[1];
      setNewScreenSize(detected);
      setAutoDetectedSize(detected);
    } else if (!cleaned) {
      setNewScreenSize('');
      setAutoDetectedSize(null);
    }
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelNumber.trim() || similarityResult.level === 'BLOCK') return;

    startTransition(async () => {
      const res = await renameTvModelAction(
        modelId,
        newModelNumber.trim().toUpperCase(),
        newScreenSize.trim() || undefined
      );

      if (res.success) {
        if (similarityResult.level === 'WARN_11') {
          toast.warning(`Model updated to "${newModelNumber.trim().toUpperCase()}" (11+ Match: ${similarityResult.conflictingName})`);
        } else if (similarityResult.level === 'WARN_8') {
          toast.warning(`Model updated to "${newModelNumber.trim().toUpperCase()}" (8+ Match: ${similarityResult.conflictingName})`);
        } else if (similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN') {
          toast.success(`Model updated to "${newModelNumber.trim().toUpperCase()}" (Similar to: ${similarityResult.conflictingName})`);
        } else {
          toast.success(`Model updated to "${newModelNumber.trim().toUpperCase()}"`);
        }
        setIsRenameOpen(false);
      } else {
        toast.error(res.error || 'Failed to rename model');
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTvModelAction(modelId);
      if (res.success) {
        toast.success(`Model "${modelNumber}" deleted successfully`);
        setIsDeleteOpen(false);
        if (onDeleteSuccess) onDeleteSuccess();
        const targetBrandId = (res as any).brandId || brandId;
        const targetUrl = targetBrandId ? `/knowledge-base/brands/${targetBrandId}` : '/knowledge-base';
        router.replace(targetUrl);
      } else {
        toast.error(res.error || 'Failed to delete model');
      }
    });
  };

  return (
    <>
      {/* Desktop View: Standard Compact Dropdown */}
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Model options"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer outline-none active:scale-95"
          >
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-border/80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {isAdmin && (
              <DropdownMenuItem
                onClick={() => setIsRenameOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Pencil className="w-3.5 h-3.5 text-primary" />
                <span>Rename Model</span>
              </DropdownMenuItem>
            )}

            {isAdmin && <DropdownMenuSeparator className="my-1 border-border/60" />}

            {isAdmin && (
              <DropdownMenuItem
                onClick={() => setIsDeleteOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-red-600 focus:text-red-700 hover:bg-red-50 focus:bg-red-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Model</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile View: 3-dots trigger button opening iOS bottom sheet */}
      <div className="sm:hidden">
        <button
          type="button"
          aria-label="Model options"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMobileOpen(true);
          }}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer outline-none active:scale-95"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile View: Authentic iOS Bottom Sheet Page */}
      {mounted &&
        createPortal(
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

                  {/* Sheet Scrollable Body */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-y-auto px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 no-scrollbar flex flex-col items-center w-full"
                  >
                    {/* Model Preview Card Inside Sheet */}
                    <div className="w-full p-4 rounded-2xl bg-muted/50 border border-border/80 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
                          <Monitor className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-foreground break-words [overflow-wrap:anywhere] leading-snug">
                              {modelNumber}
                            </span>
                            {screenSize && (
                              <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-white shrink-0">
                                {screenSize}&quot;
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground break-words">
                            {brandName || 'TV Model'} &bull; {folderCount} {folderCount === 1 ? 'Folder' : 'Folders'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Options Actions Card */}
                    <div className="w-full bg-muted/40 dark:bg-slate-800/50 rounded-2xl border border-border/60 p-1.5 space-y-1">
                      {isAdmin && (
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
                            <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Rename Model</div>
                            <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Edit model number and screen size</div>
                          </div>
                        </button>
                      )}

                      {isAdmin && (
                        <>
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
                              <div className="leading-tight text-red-600 font-bold text-xs sm:text-sm">Delete Model</div>
                              <div className="text-[10px] sm:text-[11px] font-normal text-red-400 truncate">Permanently delete model and data</div>
                            </div>
                          </button>
                        </>
                      )}
                    </div>

                    {/* iOS Style Pill Cancel Button */}
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

      {/* ── 1. RENAME TV MODEL IOS BOTTOM SHEET ── */}
      {mounted &&
        createPortal(
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
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          Rename TV Model
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          Update model number and screen size for {brandName || 'this brand'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseRename}
                      disabled={isPending}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form Body — Non-scrollable, compact, keyboard-fixed */}
                  <form onSubmit={handleRename} className="flex flex-col shrink-0">
                    <div className="px-5 sm:px-6 py-3 space-y-2.5">
                      {/* Model Number Input */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="rename-model-num" className="text-xs font-semibold text-foreground">
                            Model Number *
                          </Label>
                          {autoDetectedSize && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-2.5 h-2.5" /> {autoDetectedSize}&quot; Size
                            </span>
                          )}
                        </div>
                        <Input
                          ref={renameInputRef}
                          id="rename-model-num"
                          value={newModelNumber}
                          onChange={(e) => handleModelNumberChange(e.target.value)}
                          onBlur={persistentRenameBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const sizeInput = document.getElementById('rename-screen-size');
                              if (sizeInput) {
                                sizeInput.focus();
                              }
                            }
                          }}
                          placeholder="e.g. 55NU7100"
                          required
                          autoFocus
                          disabled={isPending}
                          className={`h-10 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border text-sm font-bold tracking-wide transition-all focus-visible:ring-2 ${
                            similarityResult.level === 'BLOCK'
                              ? 'border-rose-400 focus-visible:ring-rose-400/40 text-rose-900 bg-rose-50/40'
                              : similarityResult.level === 'WARN_11'
                              ? 'border-2 border-red-600 focus-visible:ring-red-600/50 text-red-950 bg-red-100/40 font-black'
                              : similarityResult.level === 'WARN_8'
                              ? 'border-red-500 focus-visible:ring-red-500/30 text-red-900 bg-red-50/30'
                              : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN'
                              ? 'border-amber-400 focus-visible:ring-amber-400/40 text-foreground bg-amber-50/20'
                              : 'border-border/80 focus-visible:ring-primary/30'
                          }`}
                        />

                        {/* Exact Duplicate Match Restriction Banner */}
                        {similarityResult.level === 'BLOCK' && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="font-bold text-rose-900 text-xs">Exact Duplicate Model</p>
                              <p className="text-[11px] text-rose-700 leading-tight">{similarityResult.message}</p>
                            </div>
                          </div>
                        )}

                        {/* 11+ Match Critical Warning Banner */}
                        {similarityResult.level === 'WARN_11' && (
                          <div className="p-2.5 rounded-xl bg-red-600/10 border-2 border-red-600 text-red-950 text-xs flex items-start gap-2.5 animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 fill-red-600 text-white shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-wider">
                                  11+ Match Warning
                                </span>
                                <span className="font-bold text-xs truncate">&quot;{similarityResult.matchedSequence}&quot;</span>
                              </div>
                              <p className="text-[11px] text-red-900 leading-tight mt-0.5">
                                Matches model <strong className="font-extrabold text-red-950 underline">{similarityResult.conflictingName}</strong>. You may proceed if intended.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 8-10 Match Red Warning Banner */}
                        {similarityResult.level === 'WARN_8' && (
                          <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="font-bold text-red-900 text-xs">
                                8+ Match: &quot;{similarityResult.matchedSequence}&quot;
                              </p>
                              <p className="text-[11px] text-red-800 leading-tight">
                                Matches model <strong className="font-bold text-red-950">{similarityResult.conflictingName}</strong>. You may proceed if intended.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 5-7 Match Soft Amber Warning Banner */}
                        {(similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN') && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="font-bold text-amber-900 text-xs">
                                Similar Model ({similarityResult.matchLength} Chars: &quot;{similarityResult.matchedSequence}&quot;)
                              </p>
                              <p className="text-[11px] text-amber-800 leading-tight">
                                Matches model <strong className="font-semibold text-amber-950">{similarityResult.conflictingName}</strong>.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TV Screen Size */}
                      <div className="space-y-1">
                        <Label htmlFor="rename-screen-size" className="text-xs font-semibold text-foreground">
                          TV Size (Inches)
                        </Label>
                        <div className="relative flex items-center">
                          <Input
                            id="rename-screen-size"
                            type="number"
                            min="10"
                            max="150"
                            value={newScreenSize}
                            onChange={(e) => {
                              setNewScreenSize(e.target.value);
                              setAutoDetectedSize(null);
                            }}
                            onBlur={persistentRenameBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newModelNumber.trim() && similarityResult.level !== 'BLOCK') {
                                  handleRename(e);
                                }
                              }
                            }}
                            placeholder="e.g. 55"
                            disabled={isPending}
                            className="h-10 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border-border/80 text-sm font-bold pr-16"
                          />
                          <div className="absolute right-3 text-xs font-bold text-muted-foreground pointer-events-none">
                            Inches (&quot;)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div
                      className={`px-5 sm:px-6 pt-2.5 border-t border-border/60 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 ${
                        renameViewport.isKeyboardOpen ? 'pb-3' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseRename}
                        disabled={isPending}
                        className="rounded-2xl text-xs h-10 px-4 cursor-pointer font-medium"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending || !newModelNumber.trim() || similarityResult.level === 'BLOCK'}
                        className={`rounded-2xl text-xs h-10 px-5 text-white font-bold gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
                          similarityResult.level === 'WARN_11'
                            ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800 hover:from-red-600 hover:to-rose-600 shadow-md shadow-red-600/30 border border-red-400/40 font-black'
                            : similarityResult.level === 'WARN_8'
                            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-sm shadow-red-500/20'
                            : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN'
                            ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 shadow-sm shadow-amber-500/20'
                            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary shadow-md shadow-blue-500/20'
                        }`}
                      >
                        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {similarityResult.level === 'WARN_11' ? (
                          <>
                            <span>Proceed & Save (11+ Match)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        ) : similarityResult.level === 'WARN_8' ? (
                          <>
                            <span>Proceed & Save (8+ Match)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        ) : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN' ? (
                          <>
                            <span>Proceed & Save Changes</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
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

      {/* ── 2. DELETE TV MODEL IOS BOTTOM SHEET ── */}
      {mounted &&
        createPortal(
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
                        <h2 className="text-base sm:text-lg font-bold text-red-600 leading-tight">
                          Delete TV Model
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          {brandName ? `${brandName} • ${modelNumber}` : modelNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPending) setIsDeleteOpen(false);
                      }}
                      className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content Body */}
                  <div className="p-5 sm:px-6 space-y-3.5 flex-1 overflow-y-auto no-scrollbar">
                    {/* Model Item Preview Card */}
                    <div className="p-3.5 bg-muted/40 border border-border/70 rounded-2xl flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
                        <Monitor className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                            {modelNumber}
                          </h3>
                          {screenSize && (
                            <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-background">
                              {screenSize}&quot;
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                          {folderCount} {folderCount === 1 ? 'Folder' : 'Folders'} Attached
                        </p>
                      </div>
                    </div>

                    {/* Warning Callout */}
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-red-900 dark:text-red-300 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        Permanent Action
                      </div>
                      <p className="text-[11px] sm:text-xs text-red-800 dark:text-red-400 leading-relaxed">
                        Deleting model <strong className="font-bold text-red-950 dark:text-red-200">{modelNumber}</strong> will permanently remove all associated technical folders, schematics, backlight compatibility links, and service logs. This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  {/* Footer with iOS Slide to Delete & Cancel */}
                  <div className="px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-white/95 dark:bg-slate-900/95 flex flex-col gap-2.5 shrink-0">
                    <IosSlideToConfirm
                      onConfirm={handleDelete}
                      isLoading={isPending}
                      label="slide to delete model"
                      loadingLabel="Deleting Model..."
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
