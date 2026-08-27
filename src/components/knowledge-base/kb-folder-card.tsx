'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { Folder, ArrowRight, Lightbulb, Info, FileText, Image, Mic, Sparkles } from 'lucide-react';
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
  const isBacklight = folder.name.toLowerCase() === 'backlight';
  const isMoreInfo = folder.name.toLowerCase() === 'more info';

  // Folder specific color theme configurations
  const theme = isBacklight
    ? {
        bgCanvas: 'bg-gradient-to-br from-amber-100/95 via-amber-50/90 to-amber-200/60',
        glowColor: 'bg-amber-500/20',
        iconBg: 'bg-white/95 border-amber-300/80 text-amber-600 shadow-md shadow-amber-500/10',
        strokeColor: 'rgba(245, 158, 11, 0.45)',
        badgeStyle: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
      }
    : isMoreInfo
    ? {
        bgCanvas: 'bg-gradient-to-br from-indigo-100/95 via-blue-50/90 to-indigo-200/60',
        glowColor: 'bg-indigo-500/20',
        iconBg: 'bg-white/95 border-indigo-300/80 text-indigo-600 shadow-md shadow-indigo-500/10',
        strokeColor: 'rgba(99, 102, 241, 0.45)',
        badgeStyle: 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold',
      }
    : {
        bgCanvas: 'bg-gradient-to-br from-blue-100/95 via-sky-50/90 to-slate-200/80',
        glowColor: 'bg-blue-500/20',
        iconBg: 'bg-white/95 border-blue-300/80 text-primary shadow-md shadow-blue-500/10',
        strokeColor: 'rgba(59, 130, 246, 0.40)',
        badgeStyle: 'bg-primary/10 text-primary border-primary/30 font-bold',
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
        {/* Curved Folder Body */}
        <div
          className="relative w-full h-full min-h-[155px] xs:min-h-[175px] sm:min-h-[220px] bg-slate-100/90 overflow-hidden transition-all duration-300 flex flex-col justify-end group-hover:shadow-2xl group-hover:-translate-y-1.5"
          style={{
            clipPath: `url(#kb-folder-clip-${clipId})`,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -3px rgba(100,116,145,0.12), 0 20px 40px -4px rgba(100,116,145,0.08)',
          }}
        >
          {/* Background Canvas & Thematic Icon */}
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center pb-12 sm:pb-16 transition-colors overflow-hidden ${theme.bgCanvas}`}
          >
            {/* Ambient background glow */}
            <div
              className={`absolute w-44 h-44 rounded-full ${theme.glowColor} blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none`}
            />

            {/* Geometric Dot Pattern */}
            <div
              className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity"
              style={{
                backgroundImage: 'radial-gradient(oklch(0.35 0.15 260) 1.2px, transparent 1.2px)',
                backgroundSize: '16px 16px',
              }}
            />

            {/* Centered Thematic Icon Badge */}
            <div
              className={`relative z-10 w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border flex items-center justify-center group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 ${theme.iconBg}`}
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

          {/* Folder Content Overlay Container (Bottom) */}
          <div className="relative z-10 p-2 sm:p-4 bg-white/95 backdrop-blur-md border-t border-border/80 transition-colors flex flex-col gap-1 sm:gap-2 shadow-sm">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <h3 className="font-bold text-foreground text-xs sm:text-base tracking-tight truncate group-hover:text-primary transition-colors">
                {folder.name}
              </h3>
              {isBacklight ? (
                <Badge variant="secondary" className={`text-[9px] sm:text-[10px] py-0.5 px-1.5 sm:px-2 ${theme.badgeStyle} shrink-0`}>
                  Linker
                </Badge>
              ) : isMoreInfo ? (
                <Badge variant="secondary" className={`text-[9px] sm:text-[10px] py-0.5 px-1.5 sm:px-2 ${theme.badgeStyle} shrink-0`}>
                  Media
                </Badge>
              ) : (
                <Badge variant="secondary" className={`text-[9px] sm:text-[10px] py-0.5 px-1.5 sm:px-2 ${theme.badgeStyle} shrink-0`}>
                  Custom
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5 sm:pt-1 border-t border-border/40">
              <span className="flex items-center gap-1 font-semibold text-[10px] sm:text-[11px] text-slate-600 truncate">
                {isBacklight ? (
                  <span className="truncate">Spare Parts</span>
                ) : (
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <Image className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />
                    <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-600" />
                    <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                  </span>
                )}
              </span>
              <span className="flex items-center gap-0.5 sm:gap-1 font-bold text-primary group-hover:translate-x-0.5 transition-transform text-[10px] sm:text-[11px] shrink-0">
                Open <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </span>
            </div>
          </div>
        </div>

        {/* Clean Perimeter Border Contour */}
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
