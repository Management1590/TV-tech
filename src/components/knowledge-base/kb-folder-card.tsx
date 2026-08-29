'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { Folder, Lightbulb, Info, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface KbFolderCardData {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  modelId: string;
  modelNumber?: string;
  brandName?: string;
  _count?: {
    pages?: number;
  };
  pages?: any[];
  entity?: {
    mediaAttachments?: any[];
    targetRelationships?: any[];
  };
}

interface KbFolderCardProps {
  folder: KbFolderCardData;
  modelId: string;
  userRole?: string;
}

export function KbFolderCard({ folder, modelId, userRole = 'STAFF' }: KbFolderCardProps) {
  const clipId = useId().replace(/:/g, '');
  const nameLower = folder.name.toLowerCase();
  const isBacklight = nameLower.includes('backlight');
  const isMoreInfo = nameLower.includes('more info') || nameLower.includes('more-info');

  // Count items inside folder
  const mediaCount = folder.entity?.mediaAttachments?.length ?? 0;
  const docCount = folder.pages?.length ?? folder._count?.pages ?? 0;
  const totalItems = mediaCount + docCount;

  // Folder specific color theme configurations
  const theme = isBacklight
    ? {
        bgCanvas: 'bg-gradient-to-br from-amber-100/90 via-amber-50/70 to-amber-200/50',
        glowColor: 'bg-amber-500/20',
        iconBg: 'bg-white/95 border-amber-300/80 text-amber-600 shadow-md shadow-amber-500/10',
        strokeColor: 'rgba(245, 158, 11, 0.40)',
        badgeStyle: 'bg-white/95 text-amber-800 border-amber-300/80',
        badgeLabel: 'Linker',
      }
    : isMoreInfo
    ? {
        bgCanvas: 'bg-gradient-to-br from-indigo-100/90 via-blue-50/70 to-indigo-200/50',
        glowColor: 'bg-indigo-500/20',
        iconBg: 'bg-white/95 border-indigo-300/80 text-indigo-600 shadow-md shadow-indigo-500/10',
        strokeColor: 'rgba(99, 102, 241, 0.40)',
        badgeStyle: 'bg-white/95 text-indigo-800 border-indigo-200/80',
        badgeLabel: totalItems > 0 ? `${totalItems} items` : 'Media & Docs',
      }
    : {
        bgCanvas: 'bg-gradient-to-br from-primary/10 via-sky-50/70 to-muted/80',
        glowColor: 'bg-primary/20',
        iconBg: 'bg-white/95 border-primary/25 text-primary shadow-md shadow-primary/10',
        strokeColor: 'rgba(59, 130, 246, 0.35)',
        badgeStyle: 'bg-white/95 text-primary border-primary/30',
        badgeLabel: totalItems > 0 ? `${totalItems} items` : 'Folder',
      };

  return (
    <div className="relative group h-full flex flex-col select-none transition-all duration-300">
      {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
      <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id={`kb-folder-clip-${clipId}`} clipPathUnits="objectBoundingBox">
            <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
          </clipPath>
        </defs>
      </svg>

      <Link
        href={`/knowledge-base/models/${modelId}/folders/${folder.id}`}
        className="block h-full flex flex-col relative"
      >
        {/* 1. CLIPPED FOLDER BODY & ARTWORK */}
        <div
          className="relative w-full h-full min-h-[155px] xs:min-h-[175px] sm:min-h-[220px] bg-muted/90 overflow-hidden transition-shadow duration-300 flex flex-col justify-end group-hover:shadow-2xl"
          style={{
            clipPath: `url(#kb-folder-clip-${clipId})`,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -3px rgba(100,116,145,0.12), 0 20px 40px -4px rgba(100,116,145,0.08)',
          }}
        >
          {/* Background Canvas & Thematic Icon */}
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden ${theme.bgCanvas}`}
          >
            {/* Ambient background glow */}
            <div
              className={`absolute w-44 h-44 rounded-full ${theme.glowColor} blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none`}
            />

            {/* Geometric Dot Pattern */}
            <div
              className="absolute inset-0 opacity-[0.07] group-hover:opacity-[0.1] transition-opacity"
              style={{
                backgroundImage: 'radial-gradient(oklch(0.35 0.15 260) 1.2px, transparent 1.2px)',
                backgroundSize: '16px 16px',
              }}
            />

            {/* Centered Thematic Icon Badge */}
            <div className="relative flex flex-col items-center justify-center text-center p-2 sm:p-4">
              <div
                className={`w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all duration-300 ${theme.iconBg}`}
              >
                {isBacklight ? (
                  <Lightbulb className="h-5 w-5 sm:h-8 sm:w-8 text-amber-600" />
                ) : isMoreInfo ? (
                  <Info className="h-5 w-5 sm:h-8 sm:w-8 text-indigo-600" />
                ) : (
                  <Folder className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
                )}
              </div>
            </div>
          </div>

          {/* 2. FLOATING ITEM/TYPE BADGE (Matching Inventory & Brand Folder Cards) */}
          <div className="absolute bottom-9 sm:bottom-12 right-2 sm:right-2 z-20">
            <Badge
              variant="secondary"
              className={`backdrop-blur-md gap-1 sm:gap-1.5 text-[10px] sm:text-xs py-0.5 sm:py-1 px-1.5 sm:px-2.5 font-bold shadow-md group-hover:shadow-lg transition-all border ${theme.badgeStyle}`}
            >
              {isBacklight ? (
                <Lightbulb className="w-3 h-3 text-amber-600 shrink-0" />
              ) : isMoreInfo ? (
                <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
              ) : (
                <Folder className="w-3 h-3 text-primary shrink-0" />
              )}
              <span>{theme.badgeLabel}</span>
            </Badge>
          </div>

          {/* 3. BOTTOM BAR (Folder Name Centered - matching Inventory folder-card) */}
          <div className="absolute bottom-0 inset-x-0 z-20 px-2 sm:px-4 py-2 sm:py-3 bg-white/95 backdrop-blur-md border-t border-border/80 flex items-center justify-center text-center shadow-sm">
            <h3
              className="text-xs sm:text-base font-bold text-foreground group-hover:text-primary transition-colors tracking-tight truncate leading-tight w-full text-center"
              title={folder.name}
            >
              {folder.name}
            </h3>
          </div>
        </div>

        {/* 4. CLEAN PERIMETER BORDER CONTOUR */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 6,100 A 6,8 0 0,1 0,92 L 0,8 A 6,8 0 0,1 6,0 L 30,0 C 34,0 33,13.5 37,13.5 L 94,13.5 A 6,8 0 0,1 100,21.5 L 100,92 A 6,8 0 0,1 94,100 Z"
            fill="none"
            stroke={theme.strokeColor}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Link>
    </div>
  );
}
