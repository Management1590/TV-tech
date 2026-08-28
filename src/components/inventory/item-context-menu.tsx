'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MoreVertical,
  Unlink,
  FolderPlus,
  Trash2,
  ExternalLink,
  Loader2,
  ImagePlus,
  AlertTriangle,
  AlertCircle,
  Package,
  MapPin,
  Tag,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { unlinkItemFromFolderAction, deleteItemAction } from '@/features/inventory/actions/item.actions';
import { ManageItemFoldersDialog } from '@/components/inventory/manage-item-folders-dialog';
import { SetItemThumbnailDialog } from '@/components/inventory/set-item-thumbnail-dialog';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';
import { formatShortCode } from '@/lib/utils';
import { formatMoney } from '@/lib/config/currency';

export interface ItemPreviewData {
  location?: string | null;
  shortCode?: string | null;
  quantity?: number | null;
  quantityMode?: string | null;
  isOutOfStock?: boolean;
  sellingPrice?: string | number | null;
  costPrice?: string | number | null;
}

interface ItemContextMenuProps {
  itemId: string;
  itemName: string;
  folderId?: string;
  folderName?: string;
  currentThumbnailUrl?: string | null;
  userRole?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  previewData?: ItemPreviewData;
}

export function ItemContextMenu({
  itemId,
  itemName,
  folderId,
  folderName,
  currentThumbnailUrl,
  userRole = 'STAFF',
  isOpen,
  onOpenChange,
  previewData,
}: ItemContextMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isManageFoldersOpen, setIsManageFoldersOpen] = useState(false);
  const [isThumbnailDialogOpen, setIsThumbnailDialogOpen] = useState(false);
  const [isUnlinkOpen, setIsUnlinkOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobileOpen = isOpen !== undefined ? isOpen : internalOpen;
  const setMobileOpen = (open: boolean) => {
    if (onOpenChange) onOpenChange(open);
    else setInternalOpen(open);
  };

  // Lock body scroll when mobile sheet is active
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobileOpen]);

  const isAdmin = userRole === 'ADMIN';

  if (!isAdmin) return null;

  const parsedThumb = parseThumbnailUrl(currentThumbnailUrl);

  const confirmUnlink = () => {
    if (!folderId) return;
    startTransition(async () => {
      const res = await unlinkItemFromFolderAction(itemId, folderId);
      if (res.success) {
        toast.success(`Removed "${itemName}" from "${folderName || 'folder'}"`);
        setIsUnlinkOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to remove item from folder');
      }
    });
  };

  const confirmDeletePermanent = () => {
    startTransition(async () => {
      const res = await deleteItemAction(itemId);
      if (res.success) {
        toast.success(`Item "${itemName}" permanently deleted`);
        setIsDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete item');
      }
    });
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP 3-DOTS BUTTON & DROPDOWN MENU (Hidden on mobile)               */}
      {/* ========================================================================= */}
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground/80 hover:text-primary bg-white/95 hover:bg-white border border-border/80 hover:border-primary/40 shadow-xs hover:shadow-md backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
            title="Item options"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56 bg-card border-border text-foreground z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onClick={() => router.push(`/inventory/items/${itemId}`)}
              className="gap-2 cursor-pointer text-xs font-medium"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              Open Item Details
            </DropdownMenuItem>

            {isAdmin && (
              <DropdownMenuItem
                onClick={() => setIsThumbnailDialogOpen(true)}
                className="gap-2 cursor-pointer text-xs font-medium"
              >
                <ImagePlus className="h-4 w-4 text-primary" />
                Adjust Item Thumbnail...
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => setIsManageFoldersOpen(true)}
              className="gap-2 cursor-pointer text-xs font-medium"
            >
              <FolderPlus className="h-4 w-4 text-violet-500" />
              Link to other Folders...
            </DropdownMenuItem>

            {folderId && (
              <>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => setIsUnlinkOpen(true)}
                  disabled={isPending}
                  className="gap-2 cursor-pointer text-xs text-amber-600 hover:text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                >
                  <Unlink className="h-4 w-4" />
                  Remove from this Folder
                </DropdownMenuItem>
              </>
            )}

            {isAdmin && (
              <>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => setIsDeleteOpen(true)}
                  disabled={isPending}
                  className="gap-2 cursor-pointer text-xs text-red-600 hover:text-red-700 focus:text-red-700 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE MODAL OVERLAY: Full Screen Studio & iOS Spring Bottom Sheet     */}
      {/* ========================================================================= */}
      {mounted && createPortal(
        <AnimatePresence>
          {isMobileOpen && (
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
                  Item Actions
                </span>
                <button
                  type="button"
                  aria-label="Close item menu"
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

              {/* Center: Authentic Item Preview Card (iOS Spring Pop) */}
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
                className="relative z-10 w-full max-w-[260px] my-auto py-1 pointer-events-auto filter drop-shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="glass-card overflow-hidden rounded-2xl border border-border bg-white shadow-2xl flex flex-col justify-between">
                  {/* Thumbnail Image / Placeholder */}
                  {parsedThumb.url ? (
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/80 border-b border-border/70 flex items-center justify-center">
                      <img
                        src={parsedThumb.url}
                        alt={itemName}
                        style={{
                          transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                          transformOrigin: 'center center',
                        }}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/10] w-full bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-muted flex items-center justify-center border-b border-border/70">
                      <div className="w-11 h-11 rounded-xl bg-white/90 border border-primary/20 flex items-center justify-center shadow-sm text-primary">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 space-y-2 bg-white">
                    {/* Name & Quantity */}
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="font-bold text-xs text-foreground line-clamp-2 tracking-tight leading-tight">
                        {itemName}
                      </h3>
                      {previewData?.isOutOfStock ? (
                        <Badge variant="destructive" className="shrink-0 text-[9px] px-1.5 py-0 font-bold uppercase">
                          OOS
                        </Badge>
                      ) : previewData?.quantityMode === 'UNKNOWN' ? (
                        <Badge variant="secondary" className="shrink-0 text-[9px] bg-muted text-foreground border border-border/80 font-bold">
                          ∞
                        </Badge>
                      ) : (
                        <Badge
                          variant={(previewData?.quantity ?? 0) <= 5 ? 'destructive' : 'secondary'}
                          className="shrink-0 text-[9px] px-1.5 py-0 font-semibold"
                        >
                          {previewData?.quantity ?? 0} in stock
                        </Badge>
                      )}
                    </div>

                    {/* Location & Short Code */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                      {previewData?.location && (
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin className="h-3 w-3 text-muted-foreground" /> {previewData.location}
                        </span>
                      )}
                      {previewData?.shortCode && (
                        <span className="flex items-center gap-1 font-mono text-primary bg-primary/10 px-1 py-0.5 rounded text-[10px] font-bold border border-primary/20">
                          <Tag className="h-2.5 w-2.5 text-primary" /> {formatShortCode(previewData.shortCode)}
                        </span>
                      )}
                    </div>

                    {/* Price Info */}
                    {(previewData?.sellingPrice || previewData?.costPrice) && (
                      <div className="flex items-baseline gap-2 pt-1 border-t border-border/60">
                        {previewData?.sellingPrice && (
                          <span className="text-xs font-extrabold text-emerald-600 font-mono">
                            {formatMoney(previewData.sellingPrice.toString())}
                          </span>
                        )}
                        {previewData?.costPrice && (
                          <span className="text-[10px] text-muted-foreground font-medium font-mono">
                            Cost: {formatMoney(previewData.costPrice.toString())}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Bottom: iOS Spring Actions Sheet */}
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
                {/* Actions Box */}
                <div className="bg-white rounded-3xl p-2 border border-border shadow-2xl flex flex-col gap-1">
                  {/* Action 1: Open Item Details */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileOpen(false);
                      router.push(`/inventory/items/${itemId}`);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-muted/50 active:bg-muted active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/5 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-foreground font-bold">Open Item Details</div>
                      <div className="text-[11px] font-normal text-muted-foreground">View specs, stock, history</div>
                    </div>
                  </button>

                  {/* Action 2: Adjust Item Thumbnail */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileOpen(false);
                      setIsThumbnailDialogOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-muted/50 active:bg-muted active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
                      <ImagePlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-foreground font-bold">Adjust Thumbnail</div>
                      <div className="text-[11px] font-normal text-muted-foreground">Upload or position cover image</div>
                    </div>
                  </button>

                  {/* Action 3: Link to Other Folders */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMobileOpen(false);
                      setIsManageFoldersOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-muted/50 active:bg-muted active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="leading-tight text-foreground font-bold">Manage Folder Links</div>
                      <div className="text-[11px] font-normal text-muted-foreground">Link item to multiple categories</div>
                    </div>
                  </button>

                  {/* Action 4: Remove from Folder (if folderId present) */}
                  {folderId && (
                    <div className="border-t border-border/60 my-0.5 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMobileOpen(false);
                          setIsUnlinkOpen(true);
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-50 active:bg-amber-100 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                          <Unlink className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="leading-tight text-amber-900 font-bold">Remove from Folder</div>
                          <div className="text-[11px] font-normal text-amber-700/80">Unlink from current category</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Action 5: Delete Permanently */}
                  <div className="border-t border-border/60 my-0.5 pt-0.5">
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
                        <div className="leading-tight text-red-600 font-bold">Delete Permanently</div>
                        <div className="text-[11px] font-normal text-red-400">Irreversible item removal</div>
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
                  className="w-full py-3.5 bg-white text-foreground/90 font-extrabold text-sm rounded-2xl border border-border shadow-lg active:bg-muted active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Unlink Item Confirmation Dialog */}
      <Dialog open={isUnlinkOpen} onOpenChange={isPending ? undefined : setIsUnlinkOpen}>
        <DialogContent className="bg-white/95 border-border text-foreground backdrop-blur-2xl p-5 sm:p-6 shadow-2xl rounded-2xl sm:max-w-[480px]">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-foreground">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
                <Unlink className="w-4 h-4" />
              </div>
              Remove from Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Remove <span className="font-semibold text-foreground">"{itemName}"</span> from category <span className="font-semibold text-primary">"{folderName}"</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Note on Folder Links</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800/90">
                This will only unlink the item from <strong>{folderName}</strong>. The item data, price records, specifications, and links to any other folders will remain completely safe in your inventory.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsUnlinkOpen(false)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmUnlink}
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-9 px-4 rounded-xl shadow-md shadow-amber-600/20 gap-1.5 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Unlink className="w-3.5 h-3.5" />
                  Remove Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Item Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={isPending ? undefined : setIsDeleteOpen}>
        <DialogContent className="bg-white/95 border-border text-foreground backdrop-blur-2xl p-5 sm:p-6 shadow-2xl rounded-2xl sm:max-w-[480px]">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-500/30 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              Permanently Delete Item
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to completely delete <span className="font-semibold text-foreground">"{itemName}"</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="p-3.5 bg-red-50/80 border border-red-200/90 rounded-xl text-xs text-red-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-700">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Irreversible Action</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-900/90">
                This will permanently delete this item, all attached media, supplier price records, stock movement history, and specifications. This action <strong>cannot be undone</strong>.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeletePermanent}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9 px-4 rounded-xl shadow-md shadow-red-600/20 gap-1.5 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageItemFoldersDialog
        itemId={itemId}
        itemName={itemName}
        isOpen={isManageFoldersOpen}
        onOpenChange={setIsManageFoldersOpen}
      />

      <SetItemThumbnailDialog
        itemId={itemId}
        itemName={itemName}
        folderName={folderName}
        currentThumbnailUrl={currentThumbnailUrl}
        open={isThumbnailDialogOpen}
        onOpenChange={setIsThumbnailDialogOpen}
      />
    </>
  );
}
