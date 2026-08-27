'use client';

import React, { useState, useEffect, useTransition, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
}: BrandContextMenuProps) {
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

  const isAdmin = !!userRole;

  React.useEffect(() => {
    if (isRenameOpen) setNewName(brandName);
  }, [isRenameOpen, brandName]);

  React.useEffect(() => {
    if (isDescriptionOpen) setNewDescription(currentDescription || '');
  }, [isDescriptionOpen, currentDescription]);

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
            className="h-7 w-7 inline-flex items-center justify-center rounded-xl bg-white/40 hover:bg-white text-slate-700 hover:text-primary border border-white/60 hover:border-white shadow-2xs hover:shadow-md backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer z-20 group/menu"
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
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-slate-100"
            >
              <Pencil className="w-3.5 h-3.5 text-blue-600" />
              <span>Rename Brand</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setIsDescriptionOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-slate-100"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Edit Description</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setIsThumbnailOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-slate-100"
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
              {/* SVG ClipPath Definition for Preview Brand Folder Silhouette */}
              <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
                <defs>
                  <clipPath id={`preview-brand-folder-clip-${previewClipId}`} clipPathUnits="objectBoundingBox">
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
                  Brand Actions
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

              {/* Center: Authentic Brand Folder Preview (Exact same folder structure as grid) */}
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
                  {/* 1. CLIPPED FOLDER BODY & RICH TINTED ARTWORK */}
                  <div
                    className="relative w-full h-full bg-slate-100/95 overflow-hidden flex flex-col justify-end shadow-2xl"
                    style={{
                      clipPath: `url(#preview-brand-folder-clip-${previewClipId})`,
                    }}
                  >
                    {/* Background Artwork or Rich Tinted Brand Gradient Canvas */}
                    {parsedThumb.url ? (
                      <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-200/90 flex items-center justify-center">
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
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/90 via-indigo-100/70 to-slate-200/90 flex items-center justify-center overflow-hidden">
                        {/* Soft radial primary ambient glow */}
                        <div className="absolute w-36 h-36 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
                        {/* Geometric pattern */}
                        <div
                          className="absolute inset-0 opacity-[0.08]"
                          style={{
                            backgroundImage: 'radial-gradient(oklch(0.40 0.22 260) 1.2px, transparent 1.2px)',
                            backgroundSize: '14px 14px',
                          }}
                        />
                        <div className="relative flex flex-col items-center justify-center text-center p-2">
                          <div className="w-11 h-11 rounded-2xl bg-white/95 border border-primary/30 shadow-md flex items-center justify-center text-primary mb-1">
                            <Tv className="w-6 h-6 text-primary" />
                          </div>
                          {currentDescription && (
                            <p className="text-[9px] text-slate-600 line-clamp-1 max-w-[130px] font-semibold">
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
                        className="bg-white/95 text-primary border border-primary/30 backdrop-blur-md gap-1 text-[9px] py-0.5 px-1.5 font-bold shadow-md"
                      >
                        <Tv className="w-2.5 h-2.5" />
                        {modelCount} {modelCount === 1 ? 'Model' : 'Models'}
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
                      <div className="leading-tight text-slate-900 font-bold">Rename Brand</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Change manufacturer name</div>
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
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-slate-900 font-bold">Edit Description</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Update brand overview</div>
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
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                      <ImagePlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-slate-900 font-bold">Change Logo / Thumbnail</div>
                      <div className="text-[11px] font-normal text-slate-500 truncate">Upload brand logo artwork</div>
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
                        <div className="leading-tight text-red-600 font-bold">Delete Brand</div>
                        <div className="text-[11px] font-normal text-red-400 truncate">Remove brand & its models</div>
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

      {/* ── 1. RENAME BRAND DIALOG ── */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Rename Brand
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update the official display name of this TV brand.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRename} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Brand Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="h-11 rounded-xl bg-slate-50 border-border/80 text-sm"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !newName.trim() || newName.trim() === brandName}
                className="rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 2. EDIT DESCRIPTION DIALOG ── */}
      <Dialog open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Edit Brand Description
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide background info, warranty guidelines, or technical notes for {brandName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateDescription} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Description / Notes</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g. Major Korean manufacturer, panel voltage conventions, common chassis..."
                rows={4}
                className="rounded-xl bg-slate-50 border-border/80 text-sm"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDescriptionOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Description
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 3. INTERACTIVE DRAG-TO-ADJUST THUMBNAIL DIALOG ── */}
      <SetBrandThumbnailDialog
        brandId={brandId}
        brandName={brandName}
        currentLogoUrl={currentLogoUrl}
        open={isThumbnailOpen}
        onOpenChange={setIsThumbnailOpen}
      />

      {/* ── 4. DELETE BRAND WARNING DIALOG ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Brand Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete brand &ldquo;{brandName}&rdquo;?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            {modelCount > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Deletion Blocked: Brand Contains {modelCount} Model(s)
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  As per system safety rules, you cannot delete a brand folder that still contains registered TV models. Please open this brand and delete all inside models first.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 leading-relaxed">
                This brand folder is empty (0 models). Deleting it will permanently remove the brand category from the TV Knowledge Base. This action cannot be undone.
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || modelCount > 0}
              className="rounded-xl text-xs font-semibold gap-2"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete Brand Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
