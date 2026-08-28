'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Package, MapPin, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatShortCode } from '@/lib/utils';
import { formatMoney } from '@/lib/config/currency';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';
import { ItemContextMenu } from './item-context-menu';

export interface ItemCardData {
  id: string;
  name: string;
  location?: string | null;
  quantity?: number | null;
  quantityMode?: string | null;
  isOutOfStock?: boolean;
  supplierRecords?: any[];
  entity?: {
    mediaAttachments?: any[];
  };
  folderItems?: any[];
}

interface ItemCardProps {
  item: ItemCardData;
  folderId?: string;
  folderName?: string;
  userRole?: string;
}

export function ItemCard({
  item,
  folderId,
  folderName,
  userRole = 'STAFF',
}: ItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const latestRecord = item.supplierRecords?.[0];
  const primaryAttachment =
    item.entity?.mediaAttachments?.find((a: any) => a.purpose === 'PRIMARY') ||
    item.entity?.mediaAttachments?.[0];
  const thumbnail = primaryAttachment?.media;
  const parsedThumb = parseThumbnailUrl(thumbnail?.secureUrl || thumbnail?.url);
  const effectiveFolder = folderId ? { id: folderId, name: folderName || '' } : item.folderItems?.[0]?.folder;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (userRole !== 'ADMIN') return;
    isLongPressRef.current = false;
    setIsPressing(true);
    if (e.touches.length > 0) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsPressing(false);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(50);
      }
      setMenuOpen(true);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      setIsPressing(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsPressing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('last_active_element_id', `item-card-${item.id}`);
      sessionStorage.setItem('scroll_pos_' + window.location.pathname, window.scrollY.toString());
    }
  };

  return (
    <div id={`item-card-${item.id}`} className="relative group h-full select-none">
      <div
        className={`relative w-full h-full flex flex-col transition-all duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.015] ${
          isPressing ? 'scale-[0.96] opacity-95 transition-transform duration-200 ease-out' : ''
        }`}
      >
        {/* Context Menu (Desktop 3-dots / Mobile Hold to Edit) */}
        {userRole === 'ADMIN' && (
          <div className="absolute top-2.5 right-2.5 z-30">
            <ItemContextMenu
              itemId={item.id}
              itemName={item.name}
              folderId={effectiveFolder?.id}
              folderName={effectiveFolder?.name}
              currentThumbnailUrl={thumbnail?.secureUrl || thumbnail?.url || null}
              userRole={userRole}
              isOpen={menuOpen}
              onOpenChange={setMenuOpen}
              previewData={{
                location: item.location,
                shortCode: latestRecord?.shortCode,
                quantity: item.quantity,
                quantityMode: item.quantityMode,
                isOutOfStock: item.isOutOfStock,
                sellingPrice: latestRecord?.sellingPrice ? Number(latestRecord.sellingPrice) : null,
                costPrice: latestRecord?.costPrice ? Number(latestRecord.costPrice) : null,
              }}
            />
          </div>
        )}

        <Link
          href={`/inventory/items/${item.id}`}
          className="block h-full flex flex-col flex-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onClick={handleClick}
          onContextMenu={(e) => {
            if (userRole === 'ADMIN') {
              e.preventDefault();
            }
          }}
        >
          <div className="glass-card overflow-hidden h-full rounded-2xl border border-border/90 bg-muted/50 hover:border-primary/40 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-blend">
            <div>
              {/* Seamless Thumbnail Image / Tinted Placeholder */}
              {parsedThumb.url ? (
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/80 border-b border-border/70 rounded-t-2xl flex items-center justify-center">
                  <img
                    src={parsedThumb.url}
                    alt={item.name}
                    style={{
                      transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                      transformOrigin: 'center center',
                    }}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ) : (
                <div className="aspect-[16/10] w-full bg-gradient-to-br from-primary/10 via-primary/5 to-muted/90 flex items-center justify-center border-b border-border/70 rounded-t-2xl">
                  <div className="w-12 h-12 rounded-xl bg-white/90 border border-primary/20 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                </div>
              )}

              <div className="p-4 space-y-2.5 bg-white/95">
                {/* Name & Quantity */}
                <div className="flex items-start justify-between gap-2 pr-6">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors tracking-tight">
                    {item.name}
                  </h3>
                  {item.isOutOfStock ? (
                    <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0 font-bold uppercase">
                      OOS
                    </Badge>
                  ) : item.quantityMode === 'UNKNOWN' ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px] bg-muted text-foreground border border-border/80 font-bold">
                      ∞
                    </Badge>
                  ) : (
                    <Badge
                      variant={(item.quantity ?? 0) <= 5 ? 'destructive' : 'secondary'}
                      className="shrink-0 text-[10px] px-1.5 py-0 font-semibold"
                    >
                      {item.quantity} in stock
                    </Badge>
                  )}
                </div>

                {/* Location & Code */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {item.location && (
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {item.location}
                    </span>
                  )}
                  {latestRecord && (
                    <span className="flex items-center gap-1 font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px] font-bold border border-primary/20">
                      <Tag className="h-3 w-3 text-primary" /> {formatShortCode(latestRecord.shortCode)}
                    </span>
                  )}
                </div>

                {/* Price info */}
                {latestRecord && (
                  <div className="flex items-baseline gap-2 pt-1.5 border-t border-border/60">
                    {latestRecord.sellingPrice && (
                      <span className="text-sm font-extrabold text-emerald-600 font-mono">
                        {formatMoney(latestRecord.sellingPrice.toString())}
                      </span>
                    )}
                    {latestRecord.costPrice && (
                      <span className="text-[11px] text-muted-foreground font-medium font-mono">
                        Cost: {formatMoney(latestRecord.costPrice.toString())}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
