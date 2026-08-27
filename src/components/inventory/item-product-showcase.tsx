'use client';

import React, { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package, MapPin, Tag, Clock, TrendingUp, FolderOpen,
  Monitor, ArrowDownUp, Hash, ChevronRight, Star, Trash2,
  UploadCloud, Play, Volume2, Eye, Maximize2, CheckCircle2,
  AlertTriangle, ShieldCheck, ShoppingCart, Sparkles, Layers, QrCode,
  Pencil, ImagePlus, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatShortCode } from '@/lib/utils';
import { formatMoney } from '@/lib/config/currency';
import { StockMovementDialog } from '@/components/inventory/stock-movement-dialog';
import { AddSupplierRecordDialog } from '@/components/inventory/add-supplier-record-dialog';
import { EditItemParametersDialog } from '@/components/inventory/edit-item-parameters-dialog';
import { EditItemDialog } from '@/components/inventory/edit-item-dialog';
import { ManageItemFoldersDialog } from '@/components/inventory/manage-item-folders-dialog';
import { ImageGestureLightbox } from '@/components/inventory/image-gesture-lightbox';
import { PriceHistoryChart } from '@/components/inventory/price-history-chart';
import { QrCodeDisplay } from '@/components/inventory/qr-code-display';
import { UploadItemMediaDialog } from '@/components/inventory/upload-item-media-dialog';
import { SetItemThumbnailDialog } from '@/components/inventory/set-item-thumbnail-dialog';
import { uploadMediaAction, deleteMediaAction, setPrimaryMediaAction } from '@/features/media/actions/media.actions';
import { toast } from 'sonner';

export interface MediaItem {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PDF';
  url: string;
  secureUrl?: string | null;
  publicId: string;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  purpose?: string;
}

export interface ItemProductShowcaseProps {
  item: {
    id: string;
    entityId: string;
    name: string;
    location?: string | null;
    quantityMode: string;
    quantity?: number | null;
    isOutOfStock: boolean;
    notes?: string | null;
    folderItems: Array<{
      id: string;
      folder: { id: string; name: string; materializedPath: string };
    }>;
    supplierRecords: Array<{
      id: string;
      shortCode: string;
      supplierName?: string | null;
      costPrice?: any;
      sellingPrice?: any;
      purchaseDate?: Date | null;
      remarks?: string | null;
      supplier?: { id: string; name: string; phone?: string | null } | null;
      createdAt: Date;
    }>;
    stockMovements: Array<{
      id: string;
      movementType: string;
      quantityChange: number;
      previousQuantity?: number | null;
      newQuantity?: number | null;
      notes?: string | null;
      createdAt: Date;
      performedBy?: { fullName: string } | null;
    }>;
    parameterValues: Array<{
      id: string;
      valueText?: string | null;
      valueNumber?: any;
      valueBoolean?: boolean | null;
      parameterDefinition: {
        id: string;
        name: string;
        unit?: string | null;
        valueType?: string | null;
      };
    }>;
    stockSettings?: {
      viewCount?: number;
      minimumStock?: number;
      needToPurchase?: boolean;
      totalSold?: number;
      totalPurchased?: number;
    } | null;
  };
  mediaItems: MediaItem[];
  compatibleModels: Array<{
    id: string;
    modelNumber: string;
    screenSize?: number | null;
    displayType?: string | null;
    brand?: { id: string; name: string } | null;
  }>;
  allParameterDefinitions?: Array<{
    id: string;
    name: string;
    slug: string;
    valueType: string;
    unit?: string | null;
    inheritedFromFolderName?: string;
  }>;
  userRole?: string;
}

export function ItemProductShowcase({
  item,
  mediaItems: initialMediaItems,
  compatibleModels,
  allParameterDefinitions = [],
  userRole = 'STAFF',
}: ItemProductShowcaseProps) {
  // Sort media with PRIMARY always at the front
  const sortedInitialMedia = React.useMemo(() => {
    return [...initialMediaItems].sort((a, b) => (a.purpose === 'PRIMARY' ? -1 : b.purpose === 'PRIMARY' ? 1 : 0));
  }, [initialMediaItems]);

  const [mediaList, setMediaList] = useState<MediaItem[]>(sortedInitialMedia);
  const [activeIndex, setActiveIndex] = useState(0);

  React.useEffect(() => {
    setMediaList(sortedInitialMedia);
  }, [sortedInitialMedia]);

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isManageFoldersOpen, setIsManageFoldersOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isThumbnailDialogOpen, setIsThumbnailDialogOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<MediaItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStockMovementOpen, setIsStockMovementOpen] = useState(false);
  const [isAddPriceRecordOpen, setIsAddPriceRecordOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'ADMIN';

  // Primary image fallback
  const currentMedia = mediaList[activeIndex] || mediaList[0] || null;
  const latestRecord = item.supplierRecords[0];

  // Active selected supplier price record (null by default until user explicitly clicks a code)
  const activeRecord = selectedRecordId
    ? item.supplierRecords.find((r) => r.id === selectedRecordId) || null
    : null;

  // Active price calculations based on selected code
  const activeCost = activeRecord?.costPrice ? Number(activeRecord.costPrice) : 0;
  const activeSelling = activeRecord?.sellingPrice ? Number(activeRecord.sellingPrice) : 0;
  const activeProfit = activeSelling - activeCost;
  const activeMarginPercent = activeCost > 0 ? Math.round((activeProfit / activeCost) * 100) : 0;
  const activeSupplierName =
    activeRecord?.supplierName || activeRecord?.supplier?.name || 'Unnamed Supplier';

  // Historic calculations
  const costs = item.supplierRecords
    .map((r) => (r.costPrice ? Number(r.costPrice) : null))
    .filter((v): v is number => v !== null);
  const sells = item.supplierRecords
    .map((r) => (r.sellingPrice ? Number(r.sellingPrice) : null))
    .filter((v): v is number => v !== null);

  const lowestCost = costs.length ? Math.min(...costs) : 0;

  // Handle Multi-file Upload (Cloudinary / Supabase)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityId', item.entityId);
      formData.append('purpose', mediaList.length === 0 && i === 0 ? 'PRIMARY' : 'GALLERY');

      try {
        const result = await uploadMediaAction(formData);
        if (result.success && result.media) {
          uploadedCount++;
          setMediaList((prev) => [...prev, result.media]);
        } else {
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        }
      } catch (err) {
        toast.error(`Error uploading ${file.name}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (uploadedCount > 0) {
      toast.success(`Uploaded ${uploadedCount} media file${uploadedCount > 1 ? 's' : ''}`);
    }
  };

  const handleSetPrimary = (media: MediaItem) => {
    startTransition(async () => {
      const res = await setPrimaryMediaAction(item.entityId, media.id);
      if (res.success) {
        toast.success('Set as primary image');
        setMediaList((prev) =>
          prev.map((m) => ({
            ...m,
            purpose: m.id === media.id ? 'PRIMARY' : 'GALLERY',
          }))
        );
      } else {
        toast.error(res.error || 'Failed to update primary image');
      }
    });
  };

  const confirmDeleteMedia = () => {
    if (!mediaToDelete) return;
    const media = mediaToDelete;

    startTransition(async () => {
      const res = await deleteMediaAction(media.id, media.publicId, item.entityId);
      if (res.success) {
        toast.success('Media removed');
        setMediaList((prev) => prev.filter((m) => m.id !== media.id));
        if (activeIndex >= mediaList.length - 1) {
          setActiveIndex(Math.max(0, mediaList.length - 2));
        }
        setMediaToDelete(null);
      } else {
        toast.error(res.error || 'Failed to delete media');
      }
    });
  };

  return (
    <div className="space-y-8 pb-28 sm:pb-32 relative">
      {/* Top Breadcrumb Navigation */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
        <Link href="/inventory" className="hover:text-primary transition-colors">Inventory</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        {item.folderItems[0]?.folder ? (
          <>
            <Link
              href={`/inventory/folders/${item.folderItems[0].folder.materializedPath}`}
              className="hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-none"
            >
              {item.folderItems[0].folder.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </>
        ) : null}
        <span className="text-foreground font-medium truncate">{item.name}</span>
      </nav>

      {/* ============================================================ */}
      {/* AMAZON / FLIPKART STYLE PRODUCT SHOWCASE (TOP HERO SECTION) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start bg-slate-50/80 border border-border/80 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-blend">
        
        {/* LEFT COLUMN: MULTI-IMAGE / VIDEO GALLERY (5 Cols on Desktop) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Stage Media Showcase */}
          <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-square w-full rounded-2xl bg-white border border-border/80 overflow-hidden flex items-center justify-center group shadow-sm">
            {currentMedia ? (
              currentMedia.mediaType === 'VIDEO' ? (
                <video
                  src={currentMedia.secureUrl || currentMedia.url}
                  controls
                  className="w-full h-full object-contain bg-slate-950"
                />
              ) : currentMedia.mediaType === 'AUDIO' ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Volume2 className="w-10 h-10" />
                  </div>
                  <p className="font-medium text-foreground text-sm">Technician Voice Note</p>
                  <audio
                    src={currentMedia.secureUrl || currentMedia.url}
                    controls
                    className="w-full max-w-xs"
                  />
                </div>
              ) : (
                <div
                  className="relative w-full h-full cursor-zoom-in"
                  onClick={() => setIsLightboxOpen(true)}
                >
                  <img
                    src={currentMedia.secureUrl || currentMedia.url}
                    alt={item.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-3 right-3 bg-white/90 hover:bg-white border border-border text-foreground rounded-full p-2 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Zoom</span>
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground space-y-3 p-8 text-center bg-gradient-to-br from-slate-100/80 via-indigo-50/40 to-slate-100/60 w-full h-full">
                <div className="w-16 h-16 rounded-2xl bg-white/90 border border-primary/15 flex items-center justify-center shadow-sm">
                  <Package className="w-8 h-8 stroke-1 text-primary/70" />
                </div>
                <p className="text-xs font-medium">No media uploaded yet</p>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsUploadDialogOpen(true)}
                    className="text-xs border border-dashed border-border bg-white hover:bg-slate-50 text-foreground shadow-sm h-10 sm:h-8 min-h-[40px] sm:min-h-0"
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Upload Media
                  </Button>
                )}
              </div>
            )}

            {/* Badges on Main Stage */}
            {currentMedia?.purpose === 'PRIMARY' && (
              <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Star className="w-3 h-3 fill-current text-amber-300" />
                Primary Photo
              </div>
            )}
            {currentMedia?.mediaType === 'VIDEO' && (
              <div className="absolute top-3 right-3 bg-violet-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Play className="w-3 h-3 fill-current" />
                Video Clip
              </div>
            )}
          </div>

          {/* Thumbnail Carousel Strip */}
          {mediaList.length > 0 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 touch-pan-x -mx-1 px-1">
              {mediaList.map((media, idx) => {
                const isActive = idx === activeIndex;
                const isPrimary = media.purpose === 'PRIMARY';

                return (
                  <button
                    key={media.id}
                    onClick={() => setActiveIndex(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all bg-white cursor-pointer ${
                      isActive
                        ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md'
                        : isPrimary
                        ? 'border-amber-400 ring-2 ring-amber-300/60 opacity-95 hover:opacity-100'
                        : 'border-border hover:border-primary/40 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {media.mediaType === 'IMAGE' ? (
                      <img
                        src={media.secureUrl || media.url}
                        alt="thumb"
                        className="w-full h-full object-cover"
                      />
                    ) : media.mediaType === 'VIDEO' ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-violet-500">
                        <Play className="w-5 h-5 fill-current" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-primary">
                        <Volume2 className="w-5 h-5" />
                      </div>
                    )}

                    {/* Prominent Primary Badge on Thumbnail */}
                    {isPrimary && (
                      <div className="absolute top-1 left-1 z-10 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md ring-1 ring-white/90">
                        <Star className="w-2.5 h-2.5 fill-white text-white" />
                        <span>PRIMARY</span>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Upload thumbnail tile for Admin */}
              {isAdmin && (
                <button
                  onClick={() => setIsUploadDialogOpen(true)}
                  className="shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-border hover:border-blue-500 hover:bg-primary/10 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all cursor-pointer"
                  title="Upload photos or videos"
                >
                  <UploadCloud className="w-5 h-5" />
                  <span className="text-[9px] mt-0.5 font-medium">+ Add</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Media Action Toolbar (Primary toggle / Delete) */}
          {isAdmin && currentMedia && (
            <div className="flex items-center justify-between gap-2 pt-2 text-xs border-t border-border/60">
              <div>
                {currentMedia.purpose === 'PRIMARY' ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300/80 text-amber-900 text-[11px] font-bold shadow-2xs">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>Primary Photo</span>
                  </div>
                ) : currentMedia.mediaType === 'IMAGE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetPrimary(currentMedia)}
                    disabled={isPending}
                    className="h-7 text-[11px] font-bold text-amber-800 bg-amber-50/80 border-amber-300 hover:bg-amber-100 hover:text-amber-950 transition-all shadow-2xs gap-1 cursor-pointer px-2.5 rounded-lg"
                  >
                    <Star className="w-3 h-3 text-amber-600 fill-amber-400/50" />
                    Make Primary
                  </Button>
                ) : null}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMediaToDelete(currentMedia)}
                disabled={isPending}
                className="h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 font-medium gap-1 cursor-pointer px-2 rounded-lg"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </Button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
          />
        </div>

        {/* RIGHT COLUMN: PRODUCT INFO, PRICING & ACTIONS (7 Cols on Desktop) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          
          {/* Header Title, Notes & Quick Status */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl sm:text-3xl font-black text-foreground tracking-tight leading-snug flex-1">
                {item.name}
              </h1>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="h-8 text-xs gap-1.5 border-border bg-white hover:bg-slate-50 text-foreground rounded-xl transition-all shrink-0 shadow-2xs px-2.5 font-bold cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-primary" />
                  <span>Edit</span>
                </Button>
              )}
            </div>

            {item.notes && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.notes}
              </p>
            )}

            {/* Quick Status Bar (Stock Pill + Storage Location + Views) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {/* Stock status pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 border border-border text-xs font-semibold">
                <div className={`w-2 h-2 rounded-full ${
                  item.isOutOfStock
                    ? 'bg-red-500'
                    : item.quantityMode === 'UNKNOWN'
                    ? 'bg-blue-500'
                    : (item.quantity ?? 0) <= (item.stockSettings?.minimumStock || 3)
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`} />
                <span className="font-mono text-foreground font-bold">
                  {item.isOutOfStock ? '0 in stock (OOS)' : item.quantityMode === 'UNKNOWN' ? 'Unlimited Stock (∞)' : `${item.quantity} in stock`}
                </span>
              </div>

              {/* Location Pill */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 border border-border text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-foreground font-medium truncate max-w-[160px]">{item.location || 'Unassigned Bin'}</span>
              </div>

              {/* View Count */}
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100/90 border border-border text-xs text-muted-foreground ml-auto">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{item.stockSettings?.viewCount ?? 1} views</span>
              </div>
            </div>
          </div>

          {/* All Available Short Codes / Batches Selector */}
          {item.supplierRecords.length > 0 ? (
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-primary shrink-0" />
                  Price Codes ({item.supplierRecords.length})
                </span>
                
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddPriceRecordOpen(true)}
                    className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 px-2 rounded-lg gap-1 font-bold cursor-pointer"
                  >
                    <Tag className="w-3 h-3" />
                    + Add Price Code
                  </Button>
                )}
              </div>

              {/* Code Selector Chips Container with Generous Spacing & Bold Legible Typography */}
              <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center pt-0.5">
                {item.supplierRecords.map((r, idx) => {
                  const isSelected = activeRecord?.id === r.id;
                  const cleanCode = (r.shortCode || '').replace(/^#+/, '').toUpperCase();

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRecordId(isSelected ? null : r.id)}
                      className={`group min-h-[42px] sm:min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white border-2 border-primary shadow-md ring-4 ring-primary/20 scale-[1.03]'
                          : 'bg-white hover:bg-blue-50/70 border-2 border-slate-200/90 hover:border-primary/50 text-slate-900 shadow-2xs hover:shadow-sm'
                      }`}
                      title={isSelected ? 'Click to deselect (hide price)' : `Click to view price for #${cleanCode}`}
                    >
                      <Tag className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-primary group-hover:scale-110 transition-transform'}`} />
                      <span className={`font-mono font-black text-sm sm:text-base tracking-widest ${
                        isSelected ? 'text-white' : 'text-slate-900 group-hover:text-primary'
                      }`}>
                        #{cleanCode}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 ml-0.5" />
                      ) : idx === 0 ? (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-normal" title="Latest Batch">
                          New
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-border/60">
              <Badge variant="outline" className="bg-slate-100 border-border text-muted-foreground text-xs font-semibold">
                No price codes registered
              </Badge>
            </div>
          )}

          {/* Pricing Card — Only shown when a code is selected; otherwise clean guide card */}
          {activeRecord ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-slate-50/90 border-2 border-emerald-300/80 shadow-sm space-y-3 animate-in fade-in-0 duration-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight font-mono">
                    {activeSelling > 0 ? formatMoney(activeSelling) : '—'}
                  </span>
                  <span className="font-mono font-black text-xs sm:text-sm tracking-widest px-2.5 py-1 bg-primary text-white rounded-xl shadow-xs">
                    #{(activeRecord.shortCode || '').replace(/^#+/, '').toUpperCase()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecordId(null)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-border px-2.5 py-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                  title="Deselect code (hide pricing)"
                >
                  Clear ✕
                </button>
              </div>

              {/* Cost & Margin breakdown */}
              {activeCost > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="font-semibold text-foreground font-mono">{formatMoney(activeCost)}</span>
                  <Badge variant="outline" className="bg-emerald-100/80 border-emerald-300 text-emerald-800 text-[11px] font-mono font-semibold">
                    +{activeMarginPercent}% margin ({formatMoney(activeProfit)})
                  </Badge>
                </div>
              )}

              {/* Supplier and Date context for selected code */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/60">
                <span>
                  Supplier: <strong className="text-foreground">{activeSupplierName}</strong>
                </span>
                {activeRecord.purchaseDate && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>
                      Purchased: {new Date(activeRecord.purchaseDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </>
                )}
                {activeRecord.remarks && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="italic text-muted-foreground truncate max-w-xs">{activeRecord.remarks}</span>
                  </>
                )}
              </div>

              {lowestCost > 0 && lowestCost < activeCost && (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Historic lowest cost record: <span className="font-semibold">{formatMoney(lowestCost)}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50/90 border border-border border-dashed shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  {item.supplierRecords.length > 0
                    ? 'No Price Code Selected'
                    : 'No Price Records Registered'}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {item.supplierRecords.length > 0
                    ? 'Select any price code above to view selling price, cost price, and margins.'
                    : 'No price records have been added for this item yet.'}
                </p>
              </div>
            </div>
          )}

          {/* Secondary Actions Toolbar for Admin */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddPriceRecordOpen(true)}
                className="h-8 text-xs gap-1.5 border-border bg-white hover:bg-slate-50 text-foreground font-medium rounded-xl shadow-2xs px-3 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Add Price Record</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsManageFoldersOpen(true)}
                className="h-8 text-xs gap-1.5 border-border bg-white hover:bg-slate-50 text-foreground font-medium rounded-xl shadow-2xs px-3 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Link Folders</span>
              </Button>
            </div>
          )}

          {/* Used In Folders Pills (Hidden on mobile, visible on desktop) */}
          <div className="hidden sm:block pt-2 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Categorized Under:</span>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsManageFoldersOpen(true)}
                  className="h-6 text-[11px] text-primary hover:text-primary hover:bg-primary/10 px-2 rounded-lg gap-1 font-semibold"
                >
                  + Link / Manage Folders
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {item.folderItems.map((fi) => (
                <Link key={fi.id} href={`/inventory/folders/${fi.folder.materializedPath}`}>
                  <Badge variant="outline" className="bg-white hover:bg-slate-50 border-border text-foreground text-xs py-1 px-2.5 gap-1.5 transition-all cursor-pointer shadow-2xs flex items-center">
                    <FolderOpen className="w-3.5 h-3.5 text-primary" />
                    {fi.folder.name}
                  </Badge>
                </Link>
              ))}
              {item.folderItems.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Not linked to any folder yet</span>
              )}
            </div>
          </div>

          {/* Counter Scan QR Code Bar */}
          <div className="pt-2 flex items-center gap-3 sm:gap-4 bg-white p-3 rounded-xl border border-border shadow-sm">
            <QrCode className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Counter QR Identification</p>
              <p className="text-[11px] text-muted-foreground">Scan at repair counter for instant item recall</p>
            </div>
            <div className="shrink-0">
              <QrCodeDisplay
                value={activeRecord?.shortCode ? `https://modernelectronics.app/search?q=${activeRecord.shortCode}` : `https://modernelectronics.app/inventory/items/${item.id}`}
                title={activeRecord?.shortCode ? `#${activeRecord.shortCode}` : 'Item QR'}
                size={48}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TECHNICAL SPECIFICATIONS & COMPATIBILITY DETAILS */}
      {/* ============================================================ */}
      {(() => {
        // Merge allParameterDefinitions with item.parameterValues
        const defsMap = new Map<string, { id: string; name: string; slug?: string; valueType?: string | null; unit?: string | null; inheritedFromFolderName?: string }>();

        for (const d of allParameterDefinitions) {
          defsMap.set(d.id, d);
        }
        for (const pv of item.parameterValues) {
          if (!defsMap.has(pv.parameterDefinition.id)) {
            defsMap.set(pv.parameterDefinition.id, {
              id: pv.parameterDefinition.id,
              name: pv.parameterDefinition.name,
              valueType: pv.parameterDefinition.valueType,
              unit: pv.parameterDefinition.unit,
            });
          }
        }

        const displayDefs = Array.from(defsMap.values());

        if (displayDefs.length === 0) return null;

        return (
          <Card className="glass-card rounded-2xl border border-border/80 bg-slate-50/80 shadow-blend">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Technical Specifications ({displayDefs.length})
              </CardTitle>
              {isAdmin && (
                <EditItemParametersDialog
                  itemId={item.id}
                  itemName={item.name}
                  definitions={displayDefs.map((d) => ({
                    id: d.id,
                    name: d.name,
                    slug: d.slug || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    valueType: d.valueType || 'TEXT',
                    unit: d.unit,
                    inheritedFromFolderName: d.inheritedFromFolderName,
                  }))}
                  currentValues={item.parameterValues.map((pv) => ({
                    parameterDefinitionId: pv.parameterDefinition.id,
                    valueText: pv.valueText,
                    valueNumber: pv.valueNumber,
                    valueBoolean: pv.valueBoolean,
                  }))}
                />
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {displayDefs.map((def) => {
                  const match = item.parameterValues.find((pv) => pv.parameterDefinition.id === def.id);
                  const hasValue =
                    match &&
                    ((match.valueText !== null && match.valueText !== '') ||
                      (match.valueNumber !== null && match.valueNumber !== undefined) ||
                      (match.valueBoolean !== null && match.valueBoolean !== undefined));

                  return (
                    <div key={def.id} className="bg-white border border-border/70 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                          <span>{def.name}</span>
                          {def.inheritedFromFolderName && (
                            <span className="text-[9px] text-primary font-medium lowercase">({def.inheritedFromFolderName})</span>
                          )}
                        </p>
                        <p className={`text-sm font-bold mt-1 ${hasValue ? 'text-foreground' : 'text-muted-foreground/70 italic'}`}>
                          {match?.valueText ??
                            (match?.valueNumber !== null && match?.valueNumber !== undefined
                              ? match.valueNumber.toString()
                              : match?.valueBoolean !== null && match?.valueBoolean !== undefined
                              ? match.valueBoolean
                                ? 'Yes'
                                : 'No'
                              : '— Not set')}
                          {hasValue && def.unit && (
                            <span className="text-muted-foreground font-normal text-xs ml-1">
                              {def.unit}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Compatible TV Models Grid */}
      {compatibleModels.length > 0 && (
        <Card className="glass-card rounded-2xl border border-border/80 bg-slate-50/80 shadow-blend">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5 text-violet-500" />
              Compatible TV Models ({compatibleModels.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {compatibleModels.map((m) => (
                <Link key={m.id} href={`/knowledge-base/models/${m.id}`}>
                  <div className="p-3.5 rounded-xl bg-white border border-border/70 hover:border-violet-500/40 transition-all group cursor-pointer shadow-2xs">
                    <p className="text-xs text-violet-600 font-semibold">{m.brand?.name || 'TV Model'}</p>
                    <p className="text-sm font-bold text-foreground group-hover:text-violet-600 transition-colors">
                      {m.modelNumber}
                    </p>
                    {(m.screenSize || m.displayType) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        {m.screenSize ? `${m.screenSize}" ` : ''}
                        {m.displayType || ''}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* TABS: PRICE HISTORY CHART & STOCK MOVEMENT AUDIT TRAIL */}
      {/* ============================================================ */}
      <Tabs defaultValue="price" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-slate-100/90 p-1 sm:p-1.5 rounded-xl border border-border shadow-2xs h-auto min-h-[44px]">
          <TabsTrigger
            value="price"
            className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm min-h-[40px] sm:min-h-0 text-xs sm:text-sm py-2 px-1.5 sm:px-3 flex items-center justify-center text-center"
          >
            <TrendingUp className="w-4 h-4 mr-1.5 sm:mr-2 shrink-0" />
            <span className="truncate sm:whitespace-normal">Price History & Suppliers</span>
          </TabsTrigger>
          <TabsTrigger
            value="stock"
            className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm min-h-[40px] sm:min-h-0 text-xs sm:text-sm py-2 px-1.5 sm:px-3 flex items-center justify-center text-center"
          >
            <ArrowDownUp className="w-4 h-4 mr-1.5 sm:mr-2 shrink-0" />
            <span className="truncate sm:whitespace-normal">Stock Movement ({item.stockMovements.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Price History Tab */}
        <TabsContent value="price" className="space-y-6 mt-4">
          {item.supplierRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No supplier price records yet. Click "Add Supplier Price" to record the first purchase cost.
            </p>
          ) : (
            <>
              {/* Interactive Price Trend Chart */}
              <PriceHistoryChart itemId={item.id} />

              {/* Supplier Records Ledger */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-foreground">Append-Only Supplier Records</h3>
                <div className="space-y-2.5">
                  {item.supplierRecords.map((r, idx) => (
                    <div
                      key={r.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-white border border-border/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-sm">
                            {r.supplierName || r.supplier?.name || 'Unnamed Supplier'}
                          </span>
                          {idx === 0 && (
                            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                              Current
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-mono text-[11px] text-primary border-primary/20 bg-primary/10">
                            #{r.shortCode}
                          </Badge>
                        </div>
                        {r.remarks && <p className="text-xs text-muted-foreground">{r.remarks}</p>}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        {r.costPrice && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cost</p>
                            <p className="text-sm font-bold text-foreground font-mono">
                              {formatMoney(Number(r.costPrice))}
                            </p>
                          </div>
                        )}
                        {r.sellingPrice && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Selling</p>
                            <p className="text-sm font-bold text-emerald-600 font-mono">
                              {formatMoney(Number(r.sellingPrice))}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Stock Movement History Tab */}
        <TabsContent value="stock" className="space-y-3 mt-4">
          {item.stockMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No stock movements recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {item.stockMovements.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-white border border-border/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        m.quantityChange > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="font-semibold text-foreground text-sm">{m.movementType}</span>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({m.previousQuantity} → {m.newQuantity})
                        </span>
                      </div>
                      {m.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate sm:whitespace-normal">{m.notes}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end sm:text-right text-xs text-muted-foreground pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <p className="font-medium">{new Date(m.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    {m.performedBy?.fullName && (
                      <p className="text-muted-foreground ml-2">by {m.performedBy.fullName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Gesture-Enabled Lightbox Modal */}
      <ImageGestureLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        mediaList={mediaList}
        currentIndex={activeIndex}
        onIndexChange={(newIdx) => setActiveIndex(newIdx)}
        title={item.name}
      />

      {/* Modern Stock Movement Dialog (Sold / Purchase / Sold Out - Accessible to both Admin and Staff) */}
      <StockMovementDialog
        itemId={item.id}
        itemName={item.name}
        currentQuantity={item.quantity ?? null}
        quantityMode={item.quantityMode}
        isOutOfStock={item.isOutOfStock}
        isOpen={isStockMovementOpen}
        onOpenChange={setIsStockMovementOpen}
      />

      {/* Admin-Only Management Dialogs */}
      {isAdmin && (
        <>
          {/* Manage Item Folders Dialog */}
          <ManageItemFoldersDialog
            itemId={item.id}
            itemName={item.name}
            isOpen={isManageFoldersOpen}
            onOpenChange={setIsManageFoldersOpen}
          />

          {/* Dedicated Upload Item Media Dialog */}
          <UploadItemMediaDialog
            itemId={item.id}
            entityId={item.entityId}
            itemName={item.name}
            hasExistingMedia={mediaList.length > 0}
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
            onMediaUploaded={(newMedia) => {
              setMediaList((prev) => {
                if (newMedia.purpose === 'PRIMARY') {
                  return [newMedia, ...prev.map((m) => ({ ...m, purpose: 'GALLERY' }))];
                }
                return [...prev, newMedia];
              });
              setActiveIndex(0);
            }}
          />

          {/* Edit All Item Details Dialog */}
          <EditItemDialog
            item={{
              ...item,
              parameterValues: item.parameterValues.map((pv) => ({
                parameterDefinitionId: pv.parameterDefinition.id,
                valueText: pv.valueText,
                valueNumber: pv.valueNumber,
                valueBoolean: pv.valueBoolean,
                valueDate: null,
                parameterDefinition: pv.parameterDefinition,
              })),
            }}
            definitions={allParameterDefinitions}
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />

          {/* Modern Add Price Record Dialog (Centered with Blurred Backdrop) */}
          <AddSupplierRecordDialog
            itemId={item.id}
            itemName={item.name}
            open={isAddPriceRecordOpen}
            onOpenChange={setIsAddPriceRecordOpen}
          />

          {/* Set Item Thumbnail & Card Preview Dialog */}
          <SetItemThumbnailDialog
            itemId={item.id}
            itemName={item.name}
            folderName={item.folderItems[0]?.folder?.name}
            currentThumbnailUrl={currentMedia?.secureUrl || currentMedia?.url}
            existingMedia={mediaList}
            open={isThumbnailDialogOpen}
            onOpenChange={setIsThumbnailDialogOpen}
            onThumbnailUpdated={(newUrl) => {
              if (newUrl) {
                setMediaList((prev) => [
                  {
                    id: `thumb_${Date.now()}`,
                    mediaType: 'IMAGE',
                    url: newUrl,
                    secureUrl: newUrl,
                    publicId: `thumb_${Date.now()}`,
                    purpose: 'PRIMARY',
                  },
                  ...prev.map((m) => ({ ...m, purpose: 'GALLERY' })),
                ]);
                setActiveIndex(0);
              }
            }}
          />
        </>
      )}

      {/* Delete Media Confirmation Dialog */}
      <Dialog open={!!mediaToDelete} onOpenChange={(open) => !open && !isPending && setMediaToDelete(null)}>
        <DialogContent className="bg-white/95 border-border text-foreground backdrop-blur-2xl p-6 shadow-2xl rounded-2xl sm:max-w-[440px]">
          <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-500/30 flex items-center justify-center text-red-600">
                <Trash2 className="w-4 h-4" />
              </div>
              Delete {mediaToDelete?.mediaType === 'IMAGE' ? 'Photo' : 'Media File'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this {mediaToDelete?.mediaType?.toLowerCase() || 'media'} file?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <div className="p-3.5 bg-red-50/80 border border-red-200/90 rounded-xl text-xs text-red-950 space-y-1">
              <p className="font-semibold text-red-900 truncate">
                {mediaToDelete?.filename || 'Uploaded media file'}
              </p>
              <p className="text-[11px] leading-relaxed text-red-800/90">
                This media will be removed from Cloudinary storage and unlinked from this item.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60 flex flex-row items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setMediaToDelete(null)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground h-10 sm:h-9 min-h-[40px] sm:min-h-0 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteMedia}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-10 sm:h-9 min-h-[40px] sm:min-h-0 px-4 rounded-xl shadow-md shadow-red-600/20 gap-1.5 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* PERMANENT FLOATING BOTTOM ACTION BAR (Stock Movement + Selected Code Price) */}
      {/* ========================================================================= */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-border/80 shadow-[0_-8px_30px_rgba(0,0,0,0.10)] transition-all duration-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Left: Active Code, Price & Location Context */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {activeRecord ? (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-lg sm:text-2xl font-black font-mono text-emerald-600 tracking-tight">
                    {activeSelling > 0 ? formatMoney(activeSelling) : '—'}
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-black tracking-wider px-2 py-0.5 bg-primary text-white rounded-md shadow-xs">
                    #{(activeRecord.shortCode || '').replace(/^#+/, '').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground truncate">
                  {item.location && (
                    <>
                      <span className="font-semibold text-foreground flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate max-w-[100px] sm:max-w-[150px]">{item.location}</span>
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {activeCost > 0 && (
                    <span className="font-mono font-medium">Cost: {formatMoney(activeCost)}</span>
                  )}
                  {activeCost > 0 && <span>•</span>}
                  <span className="truncate">{activeSupplierName}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight">
                    Select Price Code
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground truncate">
                  {item.location && (
                    <>
                      <span className="font-semibold text-foreground flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate max-w-[110px] sm:max-w-[160px]">{item.location}</span>
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span className="truncate">
                    {item.supplierRecords.length > 0
                      ? `${item.supplierRecords.length} codes available`
                      : 'No price codes'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Center / Right: Location Pill + Stock status badge + CTA Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Storage Location Pill (Compact) */}
            <div className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100/90 border border-border text-[11px] sm:text-xs font-bold text-slate-800">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[80px] sm:max-w-[120px]">
                {item.location || 'Unassigned'}
              </span>
            </div>

            {/* Quick Stock Indicator Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-border text-xs font-bold">
              <div className={`w-2 h-2 rounded-full ${
                item.isOutOfStock
                  ? 'bg-red-500'
                  : item.quantityMode === 'UNKNOWN'
                  ? 'bg-blue-500'
                  : (item.quantity ?? 0) <= (item.stockSettings?.minimumStock || 3)
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`} />
              <span className="font-mono text-foreground">
                {item.isOutOfStock ? '0 in stock' : `${item.quantity ?? '∞'} in stock`}
              </span>
            </div>

            {/* Primary Permanent Stock Movement CTA Button */}
            <Button
              type="button"
              onClick={() => setIsStockMovementOpen(true)}
              className="h-11 sm:h-12 px-3.5 sm:px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:via-rose-500 hover:to-amber-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/35 active:scale-95 transition-all duration-200 gap-1.5 sm:gap-2 cursor-pointer shrink-0"
            >
              <ArrowDownUp className="w-4 h-4 text-white drop-shadow shrink-0" />
              <span className="tracking-tight">Stock Movement</span>
              <span className="hidden md:inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-white/20 border border-white/30 text-white">
                Sold / Inward
              </span>
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
