"use client";

import React, { useId } from 'react';
import Link from 'next/link';
import { Folder, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FolderContextMenu } from './folder-context-menu';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';

export interface FolderCardData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  materializedPath?: string;
  _count?: {
    items: number;
  };
  itemCount?: number;
}

interface FolderCardProps {
  folder: FolderCardData;
  linkHref?: string;
  userRole?: 'ADMIN' | 'STAFF' | string;
}

export function FolderCard({ folder, linkHref, userRole = 'STAFF' }: FolderCardProps) {
  const clipId = useId().replace(/:/g, '');
  const targetHref = linkHref || `/inventory/folders/${folder.materializedPath || folder.id}`;
  const itemCount = folder._count?.items ?? folder.itemCount ?? 0;
  const parsedThumb = parseThumbnailUrl(folder.thumbnailUrl);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = React.useRef(false);
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);

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
      sessionStorage.setItem('last_active_element_id', `folder-card-${folder.id}`);
      sessionStorage.setItem('scroll_pos_' + window.location.pathname, window.scrollY.toString());
    }
  };

  return (
    <div id={`folder-card-${folder.id}`} className="relative group h-full flex flex-col select-none">
      {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
      <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id={`folder-clip-${clipId}`} clipPathUnits="objectBoundingBox">
            <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* ========================================================================= */}
      {/* UNIFIED ANIMATED CARD CONTAINER (100% synchronized transform on hover/press) */}
      {/* ========================================================================= */}
      <div className={`relative w-full h-full flex flex-col transition-all duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.015] ${isPressing ? 'scale-[0.96] opacity-95 transition-transform duration-200 ease-out' : ''}`}>
        {/* 3-DOTS ACTION MENU (Visible on desktop, triggered by hold on mobile) */}
        {userRole === 'ADMIN' && (
          <div className="absolute top-5 sm:top-10 right-1.5 sm:right-2.5 z-30">
            <FolderContextMenu
              folderId={folder.id}
              folderName={folder.name}
              currentDescription={folder.description}
              currentThumbnailUrl={folder.thumbnailUrl}
              itemCount={itemCount}
              userRole={userRole}
              isOpen={menuOpen}
              onOpenChange={setMenuOpen}
            />
          </div>
        )}

        <Link
          href={targetHref}
          className="block h-full flex flex-col relative"
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
          {/* 1. CLIPPED FOLDER BODY & FULL CONTINUOUS ARTWORK */}
          <div
            className="relative w-full h-full min-h-[155px] xs:min-h-[175px] sm:min-h-[220px] bg-slate-100/90 overflow-hidden transition-shadow duration-300 flex flex-col justify-end group-hover:shadow-2xl"
            style={{
              clipPath: `url(#folder-clip-${clipId})`,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -3px rgba(100,116,145,0.12), 0 20px 40px -4px rgba(100,116,145,0.08)',
            }}
          >
            {/* Background Artwork or Clean Tinted Gradient Canvas */}
            {parsedThumb.url ? (
              <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-200/90 flex items-center justify-center">
                <img
                  src={parsedThumb.url}
                  alt={folder.name}
                  style={{
                    transform: `translate(${parsedThumb.x}px, ${parsedThumb.y}px) scale(${parsedThumb.scale})`,
                    transformOrigin: 'center center',
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                />
                {/* Subtle bottom vignette for text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/85 via-blue-100/60 to-slate-200/90 flex items-center justify-center overflow-hidden">
                {/* Soft radial glow */}
                <div className="absolute w-44 h-44 rounded-full bg-primary/15 blur-3xl group-hover:bg-primary/25 transition-all duration-500 pointer-events-none" />
                {/* Subtle dot pattern */}
                <div
                  className="absolute inset-0 opacity-[0.07] group-hover:opacity-[0.1] transition-opacity"
                  style={{
                    backgroundImage: 'radial-gradient(oklch(0.40 0.22 260) 1.2px, transparent 1.2px)',
                    backgroundSize: '16px 16px',
                  }}
                />
                {/* Center Folder Icon */}
                <div className="relative flex flex-col items-center justify-center text-center p-2 sm:p-4">
                  <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/95 border border-primary/30 shadow-md flex items-center justify-center text-primary group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                    <Folder className="w-5 h-5 sm:w-8 sm:h-8 text-primary" />
                  </div>
                  {folder.description && (
                    <p className="text-[10px] sm:text-xs text-slate-600 mt-1 sm:mt-2.5 line-clamp-1 max-w-[130px] sm:max-w-[200px] font-semibold">
                      {folder.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 2. FLOATING ITEM COUNT BADGE */}
            <div className="absolute bottom-9 sm:bottom-12 right-2 sm:right-2 z-20">
              <Badge
                variant="secondary"
                className="bg-white/95 text-primary border border-primary/30 backdrop-blur-md gap-1 sm:gap-1.5 text-[10px] sm:text-xs py-0.5 sm:py-1 px-1.5 sm:px-2.5 font-bold shadow-md group-hover:border-primary/50 group-hover:shadow-lg transition-all"
              >
                <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Badge>
            </div>

            {/* 3. BOTTOM BAR (Folder Name Centered) */}
            <div className="absolute bottom-0 inset-x-0 z-20 px-2 sm:px-4 py-2 sm:py-3 bg-white/95 backdrop-blur-md border-t border-border/80 flex items-center justify-center text-center shadow-sm">
              <h3
                className="text-xs sm:text-base font-bold text-foreground group-hover:text-primary transition-colors tracking-tight truncate leading-tight w-full text-center"
                title={folder.name}
              >
                {folder.name}
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
              stroke="rgba(100, 116, 139, 0.35)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
