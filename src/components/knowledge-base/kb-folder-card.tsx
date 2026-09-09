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
  linkedItemsCount?: number;
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
  const backlightCount = folder.linkedItemsCount ?? 0;

  // Folder specific color theme configurations
  const theme = isBacklight
    ? {
        bgCanvas:
          'bg-gradient-to-br from-amber-100/90 via-amber-50/70 to-amber-200/50 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-amber-950/30',
        glowColor: 'bg-amber-500/20',
        emblemCard:
          'bg-white/95 dark:bg-slate-900/95 border-amber-300/80 dark:border-amber-700/80 shadow-md shadow-amber-500/10',
        pillStyle:
          'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60',
        strokeColor: 'rgba(245, 158, 11, 0.40)',
        badgeLabel:
          backlightCount > 0
            ? `${backlightCount} ${backlightCount === 1 ? 'part' : 'parts'}`
            : 'Linker',
      }
    : isMoreInfo
    ? {
        bgCanvas:
          'bg-gradient-to-br from-indigo-100/90 via-blue-50/70 to-indigo-200/50 dark:from-indigo-950/40 dark:via-blue-900/20 dark:to-indigo-950/30',
        glowColor: 'bg-indigo-500/20',
        emblemCard:
          'bg-white/95 dark:bg-slate-900/95 border-indigo-200/90 dark:border-indigo-800/80 shadow-md shadow-indigo-500/10',
        pillStyle:
          'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/70',
        strokeColor: 'rgba(99, 102, 241, 0.40)',
        badgeLabel:
          totalItems > 0
            ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`
            : 'Media & Docs',
      }
    : {
        bgCanvas: 'bg-gradient-to-br from-primary/10 via-sky-50/70 to-muted/80',
        glowColor: 'bg-primary/20',
        emblemCard:
          'bg-white/95 dark:bg-slate-900/95 border-primary/25 shadow-md shadow-primary/10',
        pillStyle: 'bg-primary/10 text-primary border-primary/30',
        strokeColor: 'rgba(59, 130, 246, 0.35)',
        badgeLabel:
          totalItems > 0
            ? `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`
            : 'Folder',
      };

  return (
    <div className="relative group h-full flex flex-col select-none transition-all duration-300">
      {/* SVG ClipPath Definition for Responsive Curved Folder Silhouette */}
      <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id={`kb-folder-clip-${clipId}`} clipPathUnits="objectBoundingBox">
            <path d="M 0.16,1 A 0.16,0.16 0 0,1 0,0.84 L 0,0.14 A 0.14,0.14 0 0,1 0.14,0 L 0.33,0 C 0.40,0 0.41,0.15 0.48,0.15 L 0.86,0.15 A 0.14,0.14 0 0,1 1,0.29 L 1,0.84 A 0.16,0.16 0 0,1 0.84,1 Z" />
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
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -3px rgba(100,116,145,0.12), 0 20px 40px -4px rgba(100,116,145,0.08)',
          }}
        >
          {/* Background Canvas & Pattern (fills whole folder) */}
          <div className={`absolute inset-0 w-full h-full overflow-hidden ${theme.bgCanvas}`}>
            {/* Ambient background glow */}
            <div
              className={`absolute w-44 h-44 rounded-full ${theme.glowColor} blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none`}
            />

            {/* Geometric Dot Pattern */}
            <div
              className="absolute inset-0 opacity-[0.07] group-hover:opacity-[0.1] transition-opacity"
              style={{
                backgroundImage:
                  'radial-gradient(oklch(0.35 0.15 260) 1.2px, transparent 1.2px)',
                backgroundSize: '16px 16px',
              }}
            />
          </div>

          {/* Centered Emblem Container (optically & geometrically centered between folder shoulder and bottom bar) */}
          <div className="absolute top-[16px] sm:top-[24px] bottom-[42px] sm:bottom-[50px] inset-x-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative flex flex-col items-center justify-center text-center p-1 pointer-events-auto">
              <div
                className={`flex flex-col items-center justify-center px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl sm:rounded-3xl border backdrop-blur-md group-hover:scale-105 group-hover:shadow-lg transition-all duration-300 ${theme.emblemCard}`}
              >
                {/* Center Icon */}
                <div className="flex items-center justify-center mb-1 sm:mb-1.5">
                  {isBacklight ? (
                    <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : isMoreInfo ? (
                    <Info className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                  )}
                </div>

                {/* Combined Information Capsule */}
                <div
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-normal border ${theme.pillStyle}`}
                >
                  {isBacklight ? (
                    <Lightbulb className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-80" />
                  ) : isMoreInfo ? (
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-80" />
                  ) : (
                    <Folder className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-80" />
                  )}
                  <span className="whitespace-nowrap leading-none">{theme.badgeLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. BOTTOM BAR (Folder Name Centered - matching Inventory folder-card) */}
          <div className="absolute bottom-0 inset-x-0 z-20 px-2 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-slate-900/95 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-center">
            <h3
              className={`text-xs sm:text-sm font-black tracking-tight truncate leading-tight w-full text-center transition-colors ${
                isBacklight
                  ? 'text-amber-800 dark:text-amber-300 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                  : isMoreInfo
                  ? 'text-indigo-800 dark:text-indigo-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  : 'text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
              }`}
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
            d="M 16,100 A 16,16 0 0,1 0,84 L 0,14 A 14,14 0 0,1 14,0 L 33,0 C 40,0 41,15 48,15 L 86,15 A 14,14 0 0,1 100,29 L 100,84 A 16,16 0 0,1 84,100 Z"
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
