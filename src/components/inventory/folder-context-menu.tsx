"use client";

import React, { useState, useEffect, useTransition, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreVertical, Pencil, FolderInput, Trash2, ImagePlus, FileText, Folder, Package, X } from 'lucide-react';
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

  // Lock body scroll when mobile overlay is active
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

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
            className="h-7 w-7 inline-flex items-center justify-center rounded-xl bg-white/40 hover:bg-white text-slate-700 hover:text-primary border border-white/60 hover:border-white shadow-2xs hover:shadow-md backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer z-20 group/menu"
          >
            <MoreVertical className="h-3.5 w-3.5 transition-transform group-hover/menu:scale-110" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 z-50 bg-white border border-border text-foreground shadow-xl rounded-2xl p-1">
            <DropdownMenuItem
              onClick={() => setIsRenameOpen(true)}
              className="cursor-pointer hover:bg-muted focus:bg-muted font-medium text-xs rounded-xl"
            >
              <Pencil className="mr-2 h-4 w-4 text-blue-600" />
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

      {/* Mobile View: Crystal Clear Portal Overlay with iOS Spring Animations */}
      {mounted && createPortal(
        <AnimatePresence>
          {mobileOpen && (
            <div
              className="fixed inset-0 z-[100] flex flex-col justify-between items-center p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:hidden select-none"
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
                    <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
                  </clipPath>
                </defs>
              </svg>

              {/* Backdrop Blur Layer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md -z-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
                }}
              />

              {/* Top Pill / Dismiss Button */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full flex items-center justify-between pt-1 px-1 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-white bg-white/20 px-3 py-1 rounded-full border border-white/30 backdrop-blur-md shadow-md">
                  Folder Actions
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Center: Authentic Folder Preview (Exact same folder structure as grid) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.82, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 10 }}
                transition={{
                  type: 'spring',
                  damping: 24,
                  stiffness: 340,
                  mass: 0.8,
                }}
                className="relative z-10 w-[190px] h-[165px] my-auto py-1 pointer-events-auto filter drop-shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative w-full h-full flex flex-col">
                  {/* 1. CLIPPED FOLDER BODY & FULL CONTINUOUS ARTWORK */}
                  <div
                    className="relative w-full h-full bg-slate-100/95 overflow-hidden flex flex-col justify-end shadow-2xl"
                    style={{
                      clipPath: `url(#preview-folder-clip-${previewClipId})`,
                    }}
                  >
                    {/* Background Artwork or Clean Tinted Gradient Canvas */}
                    {parsedThumb.url ? (
                      <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-200/90 flex items-center justify-center">
                        <img
                          src={parsedThumb.url}
                          alt={folderName}
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
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/90 via-blue-100/70 to-slate-200/90 flex items-center justify-center overflow-hidden">
                        {/* Soft radial glow */}
                        <div className="absolute w-36 h-36 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
                        {/* Subtle dot pattern */}
                        <div
                          className="absolute inset-0 opacity-[0.08]"
                          style={{
                            backgroundImage: 'radial-gradient(oklch(0.40 0.22 260) 1.2px, transparent 1.2px)',
                            backgroundSize: '14px 14px',
                          }}
                        />
                        {/* Center Folder Icon */}
                        <div className="relative flex flex-col items-center justify-center text-center p-2">
                          <div className="w-11 h-11 rounded-2xl bg-white/95 border border-primary/30 shadow-md flex items-center justify-center text-primary mb-1">
                            <Folder className="w-6 h-6 text-primary" />
                          </div>
                          {currentDescription && (
                            <p className="text-[9px] text-slate-600 line-clamp-1 max-w-[130px] font-semibold">
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

                    {/* 3. BOTTOM BAR (Folder Name Centered) */}
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
                      d="M 6,100 A 6,8 0 0,1 0,92 L 0,8 A 6,8 0 0,1 6,0 L 30,0 C 34,0 33,13.5 37,13.5 L 94,13.5 A 6,8 0 0,1 100,21.5 L 100,92 A 6,8 0 0,1 94,100 Z"
                      fill="none"
                      stroke="rgba(100, 116, 139, 0.4)"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
              </motion.div>

              {/* Bottom: Smooth Slide-up Edit Actions Sheet (iOS Spring Slide Up) */}
              <motion.div
                initial={{ opacity: 0, y: 70, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.96 }}
                transition={{
                  type: 'spring',
                  damping: 26,
                  stiffness: 320,
                  mass: 0.85,
                  delay: 0.03,
                }}
                className="relative z-10 w-full max-w-sm flex flex-col gap-2 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-2.5 space-y-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileOpen(false);
                      setIsRenameOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                      <Pencil className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-slate-900 font-bold">Rename Folder</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Change folder title</div>
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
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-slate-900 font-bold">Edit Description</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Update notes & specifications</div>
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
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 border border-violet-200 flex items-center justify-center shrink-0">
                      <ImagePlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-slate-900 font-bold">Set / Change Thumbnail</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Upload cover photo or diagram</div>
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
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                      <FolderInput className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-slate-900 font-bold">Move Folder</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Relocate in directory tree</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsDeleteOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 active:bg-red-100 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-red-600 font-bold">Delete Folder</div>
                        <div className="text-[11px] font-normal text-red-400 truncate">Permanently remove this folder</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Standalone iOS Style Cancel Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileOpen(false);
                  }}
                  className="w-full py-3.5 bg-white text-slate-800 font-extrabold text-sm rounded-2xl border border-slate-200 shadow-lg active:bg-slate-100 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> Rename Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Enter a new name for this folder.</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder name"
              disabled={isPending}
              className="bg-background border-border h-11 text-sm rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsRenameOpen(false)} disabled={isPending} className="h-10 text-xs rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isPending || !newName.trim()} className="h-10 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
              Save Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[480px] p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <FileText className="w-5 h-5 text-cyan-600" />
              Edit Folder Description
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Update or add notes/specifications for <span className="text-primary font-medium">"{folderName}"</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Brief notes or specifications for this folder category..."
              rows={4}
              disabled={isPending}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-none rounded-xl text-sm focus-visible:ring-cyan-500"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsDescriptionOpen(false)} disabled={isPending} className="border-border text-xs h-10 rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleUpdateDescription} disabled={isPending} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-10 font-bold rounded-xl">
              Save Description
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" /> Delete Folder
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Are you sure you want to delete this folder? This action cannot be undone.
              You cannot delete folders that contain items or sub-folders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isPending} className="h-10 text-xs rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending} className="h-10 text-xs font-bold rounded-xl">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
