"use client";

import React, { useState, useEffect, useTransition, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreVertical, Pencil, FolderInput, Trash2, ImagePlus, FileText, Folder, Package, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { renameFolderAction, deleteFolderAction, updateFolderDescriptionAction } from '@/features/inventory/actions/folder.actions';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';

import { MoveFolderDialog } from '@/components/inventory/move-folder-dialog';
import { SetFolderThumbnailDialog } from '@/components/inventory/set-folder-thumbnail-dialog';

interface FolderContextMenuProps {
  folderId: string;
  folderName: string;
  currentDescription?: string | null;
  currentThumbnailUrl?: string | null;
  itemCount?: number;
  userRole: 'ADMIN' | 'STAFF' | string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FolderContextMenu({
  folderId,
  folderName,
  currentDescription,
  currentThumbnailUrl,
  itemCount = 0,
  userRole,
  isOpen: mobileOpen = false,
  onOpenChange: setMobileOpen = () => {},
}: FolderContextMenuProps) {
  const previewClipId = useId().replace(/:/g, '');
  const parsedThumb = parseThumbnailUrl(currentThumbnailUrl);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isThumbnailOpen, setIsThumbnailOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [newName, setNewName] = useState(folderName);
  const [newDescription, setNewDescription] = useState(currentDescription || '');
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile overlay or dialogs are active
  useEffect(() => {
    if (mobileOpen || isRenameOpen || isDescriptionOpen || isDeleteOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen, isRenameOpen, isDescriptionOpen, isDeleteOpen]);

  React.useEffect(() => {
    if (isRenameOpen) setNewName(folderName);
  }, [isRenameOpen, folderName]);

  React.useEffect(() => {
    if (isDescriptionOpen) setNewDescription(currentDescription || '');
  }, [isDescriptionOpen, currentDescription]);

  const handleRename = () => {
    startTransition(async () => {
      const result = await renameFolderAction(folderId, newName);
      if (result.success) {
        toast.success('Folder renamed successfully');
        setIsRenameOpen(false);
      } else {
        toast.error(result.error || 'Failed to rename folder');
      }
    });
  };

  const handleUpdateDescription = () => {
    startTransition(async () => {
      const result = await updateFolderDescriptionAction(folderId, newDescription);
      if (result.success) {
        toast.success('Folder description updated successfully');
        setIsDescriptionOpen(false);
      } else {
        toast.error(result.error || 'Failed to update folder description');
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteFolderAction(folderId);
      if (result.success) {
        toast.success('Folder deleted successfully');
        setIsDeleteOpen(false);
      } else {
        toast.error(result.error || 'Failed to delete folder');
      }
    });
  };

  if (userRole !== 'ADMIN') {
    return null;
  }

  return (
    <>
      {/* Desktop View: Standard Dropdown Menu (Uncontrolled, triggers only from 3-dots on desktop) */}
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Folder actions"
            className="h-7 w-7 inline-flex items-center justify-center rounded-xl bg-white/40 hover:bg-white text-foreground/80 hover:text-primary border border-white/60 hover:border-white shadow-2xs hover:shadow-md backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer z-20 group/menu"
          >
            <MoreVertical className="h-3.5 w-3.5 transition-transform group-hover/menu:scale-110" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 z-50 bg-white border border-border text-foreground shadow-xl rounded-2xl p-1">
            <DropdownMenuItem
              onClick={() => setIsRenameOpen(true)}
              className="cursor-pointer hover:bg-muted focus:bg-muted font-medium text-xs rounded-xl"
            >
              <Pencil className="mr-2 h-4 w-4 text-primary" />
              Rename Folder
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsDescriptionOpen(true)}
              className="cursor-pointer hover:bg-muted focus:bg-muted font-medium text-xs rounded-xl"
            >
              <FileText className="mr-2 h-4 w-4 text-cyan-600" />
              Edit Description...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsThumbnailOpen(true)}
              className="cursor-pointer hover:bg-muted focus:bg-muted font-medium text-xs rounded-xl"
            >
              <ImagePlus className="mr-2 h-4 w-4 text-violet-600" />
              Set / Change Thumbnail...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsMoveOpen(true)}
              className="cursor-pointer hover:bg-muted focus:bg-muted font-medium text-xs rounded-xl"
            >
              <FolderInput className="mr-2 h-4 w-4 text-amber-600" />
              Move Folder...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50 hover:text-red-700 font-medium text-xs rounded-xl"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile View: Authentic iOS Bottom Sheet Page (Unified Folder, Options & Cancel) */}
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
                {/* SVG ClipPath Definition for Preview Folder Silhouette */}
                <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
                  <defs>
                    <clipPath id={`preview-folder-clip-${previewClipId}`} clipPathUnits="objectBoundingBox">
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

                  {/* Sheet Scrollable Body */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-y-auto px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 no-scrollbar flex flex-col items-center w-full"
                  >
                    {/* Authentic Folder Preview Inside Sheet */}
                    <div className="relative w-[175px] h-[148px] my-1 shrink-0 filter drop-shadow-md">
                      <div className="relative w-full h-full flex flex-col">
                        {/* 1. CLIPPED FOLDER BODY & ARTWORK */}
                        <div
                          className="relative w-full h-full bg-muted overflow-hidden flex flex-col justify-end shadow-md"
                          style={{
                            clipPath: `url(#preview-folder-clip-${previewClipId})`,
                          }}
                        >
                          {parsedThumb.url ? (
                            <div className="absolute inset-0 w-full h-full overflow-hidden bg-muted/80 flex items-center justify-center">
                              <img
                                src={parsedThumb.url}
                                alt={folderName}
                                style={{
                                  transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                                  transformOrigin: 'center center',
                                }}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/90 via-blue-100/70 to-muted/80 flex items-center justify-center overflow-hidden">
                              <div className="absolute w-36 h-36 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
                              <div
                                className="absolute inset-0 opacity-[0.08]"
                                style={{
                                  backgroundImage: 'radial-gradient(oklch(0.40 0.22 260) 1.2px, transparent 1.2px)',
                                  backgroundSize: '14px 14px',
                                }}
                              />
                              <div className="relative flex flex-col items-center justify-center text-center p-2">
                                <div className="w-10 h-10 rounded-2xl bg-white/95 border border-primary/30 shadow-md flex items-center justify-center text-primary mb-1">
                                  <Folder className="w-5 h-5 text-primary" />
                                </div>
                                {currentDescription && (
                                  <p className="text-[9px] text-muted-foreground line-clamp-1 max-w-[120px] font-semibold">
                                    {currentDescription}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 2. FLOATING ITEM COUNT BADGE */}
                          <div className="absolute bottom-9 right-1.5 z-20">
                            <Badge
                              variant="secondary"
                              className="bg-white/95 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[9px] py-0.5 px-1.5 font-bold shadow-md"
                            >
                              <Package className="w-2.5 h-2.5 text-primary" />
                              {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </Badge>
                          </div>

                          {/* 3. BOTTOM BAR */}
                          <div className="absolute bottom-0 inset-x-0 z-20 px-2 py-1.5 bg-white/95 backdrop-blur-md border-t border-border/80 flex items-center justify-center text-center shadow-sm">
                            <h3
                              className="text-xs font-bold text-foreground tracking-tight truncate leading-tight w-full text-center"
                              title={folderName}
                            >
                              {folderName}
                            </h3>
                          </div>
                        </div>

                        {/* 4. CLEAN PERIMETER BORDER */}
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

                    {/* Options Action Group Card */}
                    <div className="w-full bg-muted/40 dark:bg-slate-800/50 rounded-2xl border border-border/60 p-1.5 space-y-1">
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
                          <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Rename Folder</div>
                          <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Change folder title</div>
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
                        <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Edit Description</div>
                          <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Update notes & specifications</div>
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
                        <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 flex items-center justify-center shrink-0">
                          <ImagePlus className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Set / Change Thumbnail</div>
                          <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Upload cover photo or diagram</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMobileOpen(false);
                          setIsMoveOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-white dark:hover:bg-slate-700/80 active:bg-white dark:active:bg-slate-700 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                          <FolderInput className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="leading-tight text-foreground font-bold text-xs sm:text-sm">Move Folder</div>
                          <div className="text-[10px] sm:text-[11px] font-normal text-muted-foreground truncate">Relocate in directory tree</div>
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
                          <div className="leading-tight text-red-600 font-bold text-xs sm:text-sm">Delete Folder</div>
                          <div className="text-[10px] sm:text-[11px] font-normal text-red-400 truncate">Permanently remove this folder</div>
                        </div>
                      </button>
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

      {/* ── 1. RENAME FOLDER IOS BOTTOM SHEET ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isRenameOpen && (
              <div
                className="fixed inset-0 z-[110] flex flex-col justify-end items-center select-none"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    setIsRenameOpen(false);
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer"
                  onClick={() => {
                    if (!isPending) setIsRenameOpen(false);
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
                      setIsRenameOpen(false);
                    }
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu select-text"
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
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          Rename Folder
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          Enter a new name for this folder
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPending) setIsRenameOpen(false);
                      }}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form */}
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar flex-1">
                      <div className="space-y-1.5">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newName.trim() && !isPending) handleRename();
                            }
                          }}
                          placeholder="Folder name"
                          disabled={isPending}
                          autoFocus
                          className="bg-muted/40 border-border/80 h-11 text-sm font-semibold rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsRenameOpen(false)}
                        disabled={isPending}
                        className="h-9 text-xs rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleRename}
                        disabled={isPending || !newName.trim()}
                        className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-sm gap-2"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Name
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ── 2. EDIT DESCRIPTION IOS BOTTOM SHEET ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isDescriptionOpen && (
              <div
                className="fixed inset-0 z-[110] flex flex-col justify-end items-center select-none"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    setIsDescriptionOpen(false);
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer"
                  onClick={() => {
                    if (!isPending) setIsDescriptionOpen(false);
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
                      setIsDescriptionOpen(false);
                    }
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          Edit Folder Description
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          Update notes for <span className="text-primary font-medium">&ldquo;{folderName}&rdquo;</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPending) setIsDescriptionOpen(false);
                      }}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form */}
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar flex-1">
                      <Textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Brief notes or specifications for this folder category..."
                        rows={5}
                        disabled={isPending}
                        autoFocus
                        className="bg-muted/40 border-border/80 text-foreground placeholder:text-muted-foreground resize-none rounded-xl text-sm focus-visible:ring-cyan-500"
                      />
                    </div>

                    {/* Footer */}
                    <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDescriptionOpen(false)}
                        disabled={isPending}
                        className="h-9 text-xs rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleUpdateDescription}
                        disabled={isPending}
                        className="h-9 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl shadow-sm gap-2"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Description
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Set Thumbnail Dialog */}
      <SetFolderThumbnailDialog
        folderId={folderId}
        folderName={folderName}
        currentThumbnailUrl={currentThumbnailUrl}
        open={isThumbnailOpen}
        onOpenChange={setIsThumbnailOpen}
      />

      {/* Rich Interactive Move Folder Dialog */}
      <MoveFolderDialog
        folderId={folderId}
        folderName={folderName}
        open={isMoveOpen}
        onOpenChange={setIsMoveOpen}
      />

      {/* ── 3. DELETE FOLDER IOS BOTTOM SHEET ── */}
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
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer"
                  onClick={() => {
                    if (!isPending) setIsDeleteOpen(false);
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
                      setIsDeleteOpen(false);
                    }
                  }}
                  className="relative z-10 w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800/50 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-red-600 leading-tight">
                          Delete Folder
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          Permanently delete &ldquo;{folderName}&rdquo;
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPending) setIsDeleteOpen(false);
                      }}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-3.5 no-scrollbar flex-1">
                    <div className="p-3.5 rounded-2xl bg-red-50/90 border border-red-200/90 text-red-950 text-xs leading-relaxed space-y-1">
                      <p className="font-bold">Are you sure you want to delete this folder?</p>
                      <p className="text-red-800">
                        This action cannot be undone. You cannot delete folders that contain items or sub-folders.
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDeleteOpen(false)}
                      disabled={isPending}
                      className="h-10 text-xs rounded-xl px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isPending}
                      className="h-10 text-xs font-bold rounded-xl px-5 gap-2 shadow-sm"
                    >
                      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Delete Folder
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
