'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  Link2,
  Search,
  Package,
  Plus,
  Trash2,
  Check,
  Loader2,
  MapPin,
  Tag,
  ArrowRight,
  Sparkles,
  ExternalLink,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/config/currency';
import { formatShortCode } from '@/lib/utils';
import {
  linkPartToTvModelAction,
  unlinkPartFromTvModelAction,
} from '@/features/knowledge-base/actions/kb.actions';
import { searchItemsForPickerAction } from '@/features/inventory/actions/item.actions';
import { DeleteWarningDialog } from './delete-warning-dialog';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';

interface LinkedBacklightItem {
  id: string;
  name: string;
  location?: string | null;
  quantity?: number | null;
  quantityMode?: string;
  isOutOfStock?: boolean;
  folderItems?: { folder: { name: string } }[];
  supplierRecords?: {
    shortCode: string;
    sellingPrice?: any;
    costPrice?: any;
  }[];
  entity?: {
    mediaAttachments?: any[];
  };
}

interface PickerItem {
  id: string;
  name: string;
  location?: string | null;
  quantity?: number | null;
  isOutOfStock: boolean;
  quantityMode?: string | null;
  shortCode?: string | null;
  sellingPrice?: number | null;
  thumbnailUrl?: string | null;
  folderIds: string[];
  folders: Array<{ id: string; name: string }>;
}

interface PickerFolder {
  id: string;
  name: string;
  materializedPath: string;
  _count: { folderItems: number; children: number };
}

interface KbBacklightLinkerProps {
  modelId: string;
  modelName: string;
  linkedItems: LinkedBacklightItem[];
  userRole?: string;
}

export function KbBacklightLinker({
  modelId,
  modelName,
  linkedItems: initialLinkedItems,
  userRole = 'STAFF',
}: KbBacklightLinkerProps) {
  const router = useRouter();
  const isAdmin = !!userRole;

  // Linked items local state for instantaneous optimistic UI updates
  const [linkedItems, setLinkedItems] = useState<LinkedBacklightItem[]>(initialLinkedItems);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Unlink warning dialog state
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; name: string } | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Inventory Explorer & Picker state
  const [query, setQuery] = useState('');
  const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);

  const [items, setItems] = useState<PickerItem[]>([]);
  const [subFolders, setSubFolders] = useState<PickerFolder[]>([]);
  const [isLoadingPicker, setIsLoadingPicker] = useState(false);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Sync state when server props update
  useEffect(() => {
    setLinkedItems(initialLinkedItems);
  }, [initialLinkedItems]);

  // Set of linked item IDs for fast O(1) checks
  const linkedIdsSet = useMemo(() => {
    return new Set(linkedItems.map((item) => item.id));
  }, [linkedItems]);

  // Fetch Inventory items & folders whenever search query or folder navigation changes
  useEffect(() => {
    if (!isDialogOpen) return;

    let isMounted = true;
    setIsLoadingPicker(true);

    const timer = setTimeout(() => {
      searchItemsForPickerAction(query, browsingFolderId || undefined).then((res) => {
        if (!isMounted) return;
        setIsLoadingPicker(false);
        if (res.success) {
          setItems(res.items);
          setSubFolders(res.folders);
        }
      });
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isDialogOpen, query, browsingFolderId]);

  // Handle single-click link action
  const handleLinkItem = (item: PickerItem) => {
    setLinkingItemId(item.id);
    startTransition(async () => {
      const res = await linkPartToTvModelAction(item.id, modelId);
      if (res.success) {
        toast.success(`Linked "${item.name}" to ${modelName}!`);
        // Optimistically append to linked items
        const newLinked: LinkedBacklightItem = {
          id: item.id,
          name: item.name,
          location: item.location,
          quantity: item.quantity,
          isOutOfStock: item.isOutOfStock,
          folderItems: item.folders.map((f) => ({ folder: { name: f.name } })),
          supplierRecords: item.shortCode
            ? [
                {
                  shortCode: item.shortCode,
                  sellingPrice: item.sellingPrice,
                },
              ]
            : [],
          entity: {
            mediaAttachments: item.thumbnailUrl
              ? [
                  {
                    purpose: 'PRIMARY',
                    media: { url: item.thumbnailUrl, secureUrl: item.thumbnailUrl },
                  },
                ]
              : [],
          },
        };
        setLinkedItems((prev) => [newLinked, ...prev]);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to link backlight item');
      }
      setLinkingItemId(null);
    });
  };

  // Handle unlink action after confirmation
  const handleConfirmUnlink = async () => {
    if (!unlinkTarget) return;
    setIsUnlinking(true);

    try {
      const res = await unlinkPartFromTvModelAction(unlinkTarget.id, modelId);
      if (res.success) {
        toast.success(`Unlinked "${unlinkTarget.name}" from model.`);
        setLinkedItems((prev) => prev.filter((i) => i.id !== unlinkTarget.id));
        setUnlinkTarget(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to unlink item');
      }
    } catch (err: any) {
      toast.error('Error unlinking item: ' + err.message);
    } finally {
      setIsUnlinking(false);
    }
  };

  // Folder navigation handlers
  const handleEnterFolder = (folder: PickerFolder) => {
    setQuery('');
    setBrowsingFolderId(folder.id);
    setFolderHistory((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBackToRoot = () => {
    setQuery('');
    setBrowsingFolderId(null);
    setFolderHistory([]);
  };

  const handleBackStep = () => {
    setQuery('');
    if (folderHistory.length <= 1) {
      handleBackToRoot();
    } else {
      const newHist = folderHistory.slice(0, -1);
      setFolderHistory(newHist);
      setBrowsingFolderId(newHist[newHist.length - 1].id);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. ULTRA-PREMIUM BACKLIGHT STRIP INTEGRATION BANNER                       */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 p-5 sm:p-7 shadow-blend">
        <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/20 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  Backlight Strip Inventory Linker
                </h2>
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-bold px-2 py-0.5"
                >
                  {linkedItems.length} {linkedItems.length === 1 ? 'Strip Linked' : 'Strips Linked'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                Directly connect physical backlight parts from your inventory catalog to <strong className="text-foreground">{modelName}</strong> without duplicating stock items.
              </p>
            </div>
          </div>

          {isAdmin && (
            <Button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="h-10 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-amber-500/20 hover:shadow-lg active:scale-95 transition-all cursor-pointer self-start sm:self-auto shrink-0 border border-white/20"
            >
              <Plus className="w-4 h-4" />
              <span>Link Backlight from Inventory</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. LINKED BACKLIGHT ITEMS CARDS GRID                                      */}
      {/* ========================================================================= */}
      {linkedItems.length === 0 ? (
        <div className="p-16 text-center bg-white border border-border/80 border-dashed rounded-3xl shadow-blend">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3.5 text-amber-600">
            <Lightbulb className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-foreground text-base">No Backlight Strips Linked Yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Browse through your inventory folders or search by short code / part number to associate the correct LED backlight strips with this TV model.
          </p>
          {isAdmin && (
            <Button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="mt-5 h-9.5 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Open Inventory Folder Picker
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {linkedItems.map((item) => {
            const latestRecord = item.supplierRecords?.[0];
            const primaryAttachment =
              item.entity?.mediaAttachments?.find((a: any) => a.purpose === 'PRIMARY') ||
              item.entity?.mediaAttachments?.[0];
            const thumbnail = primaryAttachment?.media;
            const parsedThumb = parseThumbnailUrl(thumbnail?.secureUrl || thumbnail?.url);
            const folderName = item.folderItems?.[0]?.folder?.name;

            return (
              <div
                key={item.id}
                className="group relative bg-white border border-border/80 rounded-3xl overflow-hidden shadow-blend hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between select-none"
              >
                <Link
                  href={`/inventory/items/${item.id}`}
                  className="block flex-1 cursor-pointer"
                >
                  {/* Thumbnail Banner */}
                  {parsedThumb.url ? (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-muted border-b border-border/60 relative">
                      <img
                        src={parsedThumb.url}
                        alt={item.name}
                        style={{
                          transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                          transformOrigin: 'center center',
                        }}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        {item.isOutOfStock ? (
                          <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5 shadow-sm">
                            Out of Stock
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white border-none text-[10px] font-bold px-2 py-0.5 shadow-sm">
                            {item.quantity ?? 1} in stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[16/9] w-full bg-gradient-to-br from-amber-50 via-yellow-50/50 to-muted border-b border-border/60 flex items-center justify-center relative">
                      <Lightbulb className="w-10 h-10 text-amber-500/60" />
                      <div className="absolute top-2.5 right-2.5">
                        {item.isOutOfStock ? (
                          <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5 shadow-sm">
                            Out of Stock
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white border-none text-[10px] font-bold px-2 py-0.5 shadow-sm">
                            {item.quantity ?? 1} in stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {latestRecord?.shortCode && (
                          <span className="font-mono text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-lg border border-primary/20 font-bold">
                            #{formatShortCode(latestRecord.shortCode)}
                          </span>
                        )}
                        {folderName && (
                          <span className="text-[10px] text-muted-foreground font-medium truncate">
                            in {folderName}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-2 pt-0.5 group-hover:text-amber-800 transition-colors">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1 border-t border-border/60">
                      {item.location && (
                        <span className="flex items-center gap-1 font-semibold text-foreground/80 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {item.location}
                        </span>
                      )}

                      {latestRecord?.sellingPrice && (
                        <div className="ml-auto font-mono font-black text-sm text-emerald-600">
                          {formatMoney(latestRecord.sellingPrice.toString())}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Card Actions Footer */}
                <div className="p-3.5 bg-muted/50 border-t border-border/60 flex items-center justify-between gap-2">
                  <Link
                    href={`/inventory/items/${item.id}`}
                    className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-primary/5 transition-colors"
                  >
                    <span>Open in Inventory</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  {isAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setUnlinkTarget({ id: item.id, name: item.name });
                      }}
                      className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Unlink from this TV model"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      <span>Unlink</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PROPER INVENTORY FOLDERS & SEARCH LINKING DIALOG WINDOW                */}
      {/* ========================================================================= */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] p-0 bg-white/98 border-border/80 shadow-2xl backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col">
          {/* Dialog Header with Search Bar */}
          <DialogHeader className="p-6 pb-4 border-b border-border/60 space-y-3 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                  Link Backlight Strip to <span className="text-amber-700">{modelName}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Browse inventory categories or search to link backlight strips without creating duplicate items.
                </DialogDescription>
              </div>
            </div>

            {/* Universal Search Bar */}
            <div className="relative mt-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.trim()) {
                    setBrowsingFolderId(null);
                  }
                }}
                placeholder="Search by part name, short code (e.g. 0012), model, location..."
                className="pl-10 pr-9 bg-muted/50 border-border/80 text-foreground placeholder:text-muted-foreground text-xs sm:text-sm h-10.5 rounded-2xl shadow-2xs focus-visible:ring-2 focus-visible:ring-amber-500/30"
                autoFocus
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </DialogHeader>

          {/* Folder Breadcrumbs when browsing categories */}
          {!query && (
            <div className="px-6 py-2.5 bg-muted/50 border-b border-border/60 flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto">
              <button
                type="button"
                onClick={handleBackToRoot}
                className={`hover:text-foreground transition-colors cursor-pointer ${
                  !browsingFolderId ? 'text-amber-700 font-bold' : ''
                }`}
              >
                All Categories
              </button>
              {folderHistory.map((h, idx) => (
                <React.Fragment key={h.id}>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      const newHist = folderHistory.slice(0, idx + 1);
                      setFolderHistory(newHist);
                      setBrowsingFolderId(h.id);
                    }}
                    className={`hover:text-foreground transition-colors truncate max-w-[140px] cursor-pointer ${
                      idx === folderHistory.length - 1 ? 'text-amber-700 font-bold' : ''
                    }`}
                  >
                    {h.name}
                  </button>
                </React.Fragment>
              ))}
              {folderHistory.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackStep}
                  className="ml-auto h-6 text-[11px] font-bold text-muted-foreground hover:text-foreground gap-1 px-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </Button>
              )}
            </div>
          )}

          {/* Main Explorer Body: Categories Grid + Items List */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 max-h-[460px]">
            {isLoadingPicker ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
                <span className="text-xs font-semibold">Searching inventory items & folders...</span>
              </div>
            ) : (
              <>
                {/* Categories & Sub-Folders Grid (when browsing without search query) */}
                {!query && subFolders.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      {browsingFolderId ? 'Sub-Folders' : 'Inventory Categories'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {subFolders.map((sf) => (
                        <button
                          key={sf.id}
                          type="button"
                          onClick={() => handleEnterFolder(sf)}
                          className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-border/80 hover:border-amber-500/60 hover:bg-amber-50/40 transition-all text-left group shadow-2xs cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shrink-0">
                            <FolderOpen className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-amber-800">
                              {sf.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">
                              {sf._count.folderItems > 0
                                ? `${sf._count.folderItems} items`
                                : `${sf._count.children} folders`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {query ? `Search Results (${items.length})` : `Items in Folder (${items.length})`}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-10 rounded-3xl bg-muted/50 border border-border/80 border-dashed text-center">
                      <Package className="w-10 h-10 text-muted-foreground/70 mx-auto mb-2" />
                      <p className="text-sm font-bold text-foreground">No inventory items found</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {query
                          ? `No items matched "${query}". Try searching by short code or part model.`
                          : 'This category does not contain any backlight items yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {items.map((item) => {
                        const isAlreadyLinked = linkedIdsSet.has(item.id);
                        const isLinkingThis = linkingItemId === item.id;
                        const parsedThumb = parseThumbnailUrl(item.thumbnailUrl);

                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                              isAlreadyLinked
                                ? 'bg-amber-50/60 border-amber-300/80 shadow-2xs'
                                : 'bg-white border-border/80 hover:border-border/90 hover:shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                              {/* Item Thumbnail */}
                              <div className="w-12 h-12 rounded-xl bg-muted border border-border/80 overflow-hidden shrink-0 flex items-center justify-center relative">
                                {parsedThumb.url ? (
                                  <img
                                    src={parsedThumb.url}
                                    alt={item.name}
                                    style={{
                                      transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                                      transformOrigin: 'center center',
                                    }}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-muted-foreground/70" />
                                )}
                              </div>

                              {/* Item Info */}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                                    {item.name}
                                  </h4>
                                  {item.shortCode && (
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px] text-primary border-primary/20 bg-primary/5 px-1.5 py-0 font-bold"
                                    >
                                      #{formatShortCode(item.shortCode)}
                                    </Badge>
                                  )}
                                  {item.isOutOfStock ? (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-bold">
                                      OOS
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0 font-bold">
                                      {item.quantity ?? 1} in stock
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                                  {item.sellingPrice && (
                                    <span className="text-emerald-600 font-bold font-mono text-xs">
                                      {formatMoney(item.sellingPrice)}
                                    </span>
                                  )}
                                  {item.location && (
                                    <span className="flex items-center gap-0.5 text-muted-foreground text-[11px]">
                                      <MapPin className="w-3 h-3" /> {item.location}
                                    </span>
                                  )}
                                  {item.folders.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                                      in {item.folders.map((f) => f.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="shrink-0">
                              {isAlreadyLinked ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs px-3 py-1 gap-1.5 font-bold shadow-2xs">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Linked
                                </Badge>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isLinkingThis || isPending}
                                  onClick={() => handleLinkItem(item)}
                                  className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold text-xs gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                  {isLinkingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                  <span>Link to Model</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. UNIFIED DELETION WARNING DIALOG FOR UNLINKING                          */}
      {/* ========================================================================= */}
      <DeleteWarningDialog
        isOpen={!!unlinkTarget}
        onClose={() => !isUnlinking && setUnlinkTarget(null)}
        onConfirm={handleConfirmUnlink}
        title="Unlink Backlight Strip?"
        itemName={unlinkTarget?.name}
        itemType="backlight strip"
        isDeleting={isUnlinking}
      />
    </div>
  );
}
