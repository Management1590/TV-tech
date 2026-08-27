'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Link2,
  Search,
  FolderOpen,
  Package,
  Check,
  Plus,
  Loader2,
  Tag,
  MapPin,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/config/currency';
import { formatShortCode } from '@/lib/utils';
import {
  searchItemsForPickerAction,
  linkItemToFolderAction,
} from '@/features/inventory/actions/item.actions';

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

interface LinkExistingItemDialogProps {
  folderId: string;
  folderName: string;
  trigger?: React.ReactNode;
}

export function LinkExistingItemDialog({
  folderId,
  folderName,
  trigger,
}: LinkExistingItemDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);

  const [items, setItems] = useState<PickerItem[]>([]);
  const [subFolders, setSubFolders] = useState<PickerFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkedItemIds, setLinkedItemIds] = useState<Set<string>>(new Set());

  const [isPending, startTransition] = useTransition();

  // Fetch items when query or browsingFolderId changes
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(() => {
      searchItemsForPickerAction(query, browsingFolderId || undefined).then((res) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (res.success) {
          setItems(res.items);
          setSubFolders(res.folders);
        }
      });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [open, query, browsingFolderId]);

  const handleLinkItem = (item: PickerItem) => {
    setLinkingItemId(item.id);
    startTransition(async () => {
      const res = await linkItemToFolderAction(item.id, folderId);
      if (res.success) {
        toast.success(`Linked "${item.name}" to folder "${folderName}"`);
        setLinkedItemIds((prev) => new Set([...prev, item.id]));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to link item');
      }
      setLinkingItemId(null);
    });
  };

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger || (
          <Button
            size="sm"
            variant="outline"
            className="group h-10 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-white hover:bg-slate-100/90 text-foreground border border-border/90 hover:border-primary/40 hover:text-primary shadow-sm transition-all duration-200 active:scale-95 cursor-pointer gap-2 shrink-0"
          >
            <Link2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            <span>Link Existing Item</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background border-border">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
            <Link2 className="w-5 h-5 text-primary" />
            Link Existing Item to <span className="text-primary">"{folderName}"</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Search or browse inventory folders to link an existing item into this folder without creating duplicate data.
          </DialogDescription>

          {/* Search Bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim()) {
                  setBrowsingFolderId(null);
                }
              }}
              placeholder="Search items by name, short code, model, location..."
              className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground text-sm h-10 rounded-xl"
            />
          </div>
        </DialogHeader>

        {/* Folder Breadcrumbs when browsing */}
        {!query && (
          <div className="px-6 py-2 bg-card border-b border-border/60 flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto">
            <button
              onClick={handleBackToRoot}
              className={`hover:text-foreground transition-colors ${!browsingFolderId ? 'text-primary font-bold' : ''}`}
            >
              All Categories
            </button>
            {folderHistory.map((h, idx) => (
              <React.Fragment key={h.id}>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => {
                    const newHist = folderHistory.slice(0, idx + 1);
                    setFolderHistory(newHist);
                    setBrowsingFolderId(h.id);
                  }}
                  className={`hover:text-foreground transition-colors truncate max-w-[120px] ${
                    idx === folderHistory.length - 1 ? 'text-primary font-bold' : ''
                  }`}
                >
                  {h.name}
                </button>
              </React.Fragment>
            ))}
            {folderHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackStep}
                className="ml-auto h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </Button>
            )}
          </div>
        )}

        {/* Main Explorer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[450px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <span className="text-xs">Loading items...</span>
            </div>
          ) : (
            <>
              {/* Sub-Folders Grid (when browsing without search) */}
              {!query && subFolders.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {browsingFolderId ? 'Sub-Folders' : 'Inventory Categories'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {subFolders.map((sf) => (
                      <button
                        key={sf.id}
                        onClick={() => handleEnterFolder(sf)}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/60 border border-border/60 hover:border-blue-500/50 hover:bg-primary/5 transition-all text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                          <FolderOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                            {sf.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {query ? `Search Results (${items.length})` : `Items in Folder (${items.length})`}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-muted/30 border border-border text-center">
                    <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">No items found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {query ? `No items matched "${query}"` : 'This category does not contain items.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const isAlreadyLinked =
                        item.folderIds.includes(folderId) || linkedItemIds.has(item.id);
                      const isLinking = linkingItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            isAlreadyLinked
                              ? 'bg-blue-950/20 border-blue-900/40 text-foreground'
                              : 'bg-muted/60 border-border hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                            {/* Item Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-600" />
                              )}
                            </div>

                            {/* Item Info */}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-foreground truncate">
                                  {item.name}
                                </h4>
                                {item.shortCode && (
                                  <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/20 px-1.5 py-0">
                                    #{formatShortCode(item.shortCode)}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {item.sellingPrice && (
                                  <span className="text-emerald-600 font-bold font-mono">
                                    {formatMoney(item.sellingPrice)}
                                  </span>
                                )}
                                {item.location && (
                                  <span className="flex items-center gap-0.5 text-muted-foreground">
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
                              <Badge className="bg-emerald-50 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-1 gap-1">
                                <Check className="w-3.5 h-3.5" /> Already Linked
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleLinkItem(item)}
                                disabled={isPending || isLinking}
                                className="bg-primary hover:bg-primary text-foreground text-xs h-8 px-3 rounded-lg gap-1.5 shadow-md shadow-blue-600/20"
                              >
                                {isLinking ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                                Link to Folder
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
  );
}
