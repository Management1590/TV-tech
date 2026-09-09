'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { Tv } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BrandContextMenu } from './brand-context-menu';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';
import { recordBrandOpen } from '@/lib/kb-tracking-utils';

export interface BrandFolderData {
  id: string;
  entityId: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  modelCount: number;
  _count?: {
    models: number;
  };
}

interface BrandFolderCardProps {
  brand: BrandFolderData;
  userRole?: string;
}

export function BrandFolderCard({ brand, userRole = 'STAFF' }: BrandFolderCardProps) {
  const clipId = useId().replace(/:/g, '');
  const modelCount = brand._count?.models ?? brand.modelCount ?? 0;
  const parsedThumb = parseThumbnailUrl(brand.logoUrl);
  const cleanName = brand.name.replace(/_\d{10,}$/, '');

  const cardContainerRef = React.useRef<HTMLDivElement>(null);
  const [scaleRatio, setScaleRatio] = React.useState(1);

  React.useEffect(() => {
    if (!cardContainerRef.current) return;
    const update = (w: number) => {
      if (w > 0) {
        setScaleRatio(w / 175);
      }
    };
    update(cardContainerRef.current.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    observer.observe(cardContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const effectiveX = parsedThumb.x * scaleRatio;
  const effectiveY = parsedThumb.y * scaleRatio;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isDeleted, setIsDeleted] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = React.useRef(false);
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!userRole || isDeleted) return;
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
    if (isDeleted || menuOpen) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    recordBrandOpen(brand.id);
  };

  if (isDeleted) {
    return null;
  }

  return (
    <div className="relative group h-full flex flex-col select-none">
      {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
      <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id={`brand-folder-clip-${clipId}`} clipPathUnits="objectBoundingBox">
            <path d="M 0.16,1 A 0.16,0.16 0 0,1 0,0.84 L 0,0.14 A 0.14,0.14 0 0,1 0.14,0 L 0.33,0 C 0.40,0 0.41,0.15 0.48,0.15 L 0.86,0.15 A 0.14,0.14 0 0,1 1,0.29 L 1,0.84 A 0.16,0.16 0 0,1 0.84,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* ========================================================================= */}
      {/* UNIFIED ANIMATED CARD BODY (Everything transforms in 100% lockstep)       */}
      {/* ========================================================================= */}
      <div
        className={`relative w-full h-full flex flex-col group-hover:-translate-y-1.5 group-hover:scale-[1.015] transition-all duration-300 ${
          isPressing
            ? 'scale-[0.96] opacity-90 transition-transform duration-150 ease-out'
            : 'scale-100 opacity-100 transition-transform duration-250 ease-out'
        }`}
      >
        {/* 3-Dots Context Menu Button (Embedded into Top-Right shoulder, hidden on mobile) */}
        {!!userRole && (
          <div className="absolute top-5 sm:top-10 right-1.5 sm:right-3 z-30">
            <BrandContextMenu
              brandId={brand.id}
              brandName={brand.name}
              entityId={brand.entityId}
              modelCount={modelCount}
              currentDescription={brand.description}
              currentLogoUrl={brand.logoUrl}
              userRole={userRole}
              isOpen={menuOpen}
              onOpenChange={setMenuOpen}
              onDeleteSuccess={() => {
                setIsDeleted(true);
                setMenuOpen(false);
              }}
            />
          </div>
        )}

        <Link
          href={`/knowledge-base/brands/${brand.id}`}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onContextMenu={(e) => {
            if (userRole) {
              e.preventDefault();
            }
          }}
          className="block h-full flex flex-col relative"
        >
          {/* 1. CLIPPED FOLDER BODY & RICH TINTED ARTWORK (100% matched to Inventory folder-card) */}
          <div
            ref={cardContainerRef}
            className="relative w-full h-full min-h-[155px] xs:min-h-[175px] sm:min-h-[220px] bg-muted overflow-hidden transition-shadow duration-300 flex flex-col justify-end group-hover:shadow-2xl"
            style={{
              clipPath: `url(#brand-folder-clip-${clipId})`,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -3px rgba(100,116,145,0.12), 0 20px 40px -4px rgba(100,116,145,0.08)',
            }}
          >
            {/* Background Artwork or Rich Tinted Brand Gradient Canvas */}
            {parsedThumb.url ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden bg-muted/80 flex items-center justify-center">
                <img
                  src={parsedThumb.url}
                  alt={brand.name}
                  style={{
                    transform: `translate(${effectiveX}px, ${effectiveY}px) scale(${parsedThumb.scale})`,
                    transformOrigin: 'center center',
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                />
                {/* Subtle bottom vignette for text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-100/90 via-slate-50/80 to-slate-100/60 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-slate-900/60 flex items-center justify-center overflow-hidden">
                {/* Soft ambient glow */}
                <div className="absolute w-48 h-48 rounded-full bg-slate-300/25 dark:bg-slate-700/25 blur-3xl group-hover:bg-slate-300/40 transition-all duration-500 pointer-events-none" />
                {/* Geometric pattern */}
                <div
                  className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity"
                  style={{
                    backgroundImage: 'radial-gradient(oklch(0.50 0.05 260) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
                <div className="relative flex flex-col items-center justify-center text-center p-2 sm:p-4">
                  <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-110 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:shadow-md transition-all duration-300">
                    <Tv className="w-5 h-5 sm:w-8 sm:h-8" />
                  </div>
                  {brand.description && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground/80 mt-1 sm:mt-2.5 line-clamp-1 max-w-[130px] sm:max-w-[200px] font-medium">
                      {brand.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 2. FLOATING MODEL COUNT BADGE (Minimalist Premium Icon + Number) */}
            <div className="absolute bottom-[44px] sm:bottom-[52px] right-2 sm:right-2.5 z-20">
              <Badge
                variant="secondary"
                className="bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md gap-1 text-[10px] sm:text-xs py-0.5 px-1.5 font-black shadow-xs group-hover:border-slate-300 group-hover:shadow-sm transition-all"
                title={`${modelCount} ${modelCount === 1 ? 'Model' : 'Models'}`}
              >
                <Tv className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
                <span>{modelCount}</span>
              </Badge>
            </div>

            {/* 3. SOLID BOTTOM BAR WITH CENTERED TITLE */}
            <div className="relative z-20 px-2 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-slate-900/95 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-center text-center">
              <h3
                className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors tracking-tight truncate leading-tight w-full text-center"
                title={cleanName}
              >
                {cleanName}
              </h3>
            </div>
          </div>

          {/* 4. CLEAN PERIMETER BORDER CONTOUR (100% synchronized in same card wrapper) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
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
        </Link>
      </div>
    </div>
  );
}
