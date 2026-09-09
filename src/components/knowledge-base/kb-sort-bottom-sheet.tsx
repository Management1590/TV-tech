'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Flame,
  ArrowDownAZ,
  Sparkles,
  Clock,
  Check,
  ChevronDown,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type KbSortOption = 'most-opened' | 'name' | 'recently-added' | 'oldest-added';

export interface SortOptionItem {
  id: KbSortOption;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

export const KB_SORT_OPTIONS: SortOptionItem[] = [
  {
    id: 'most-opened',
    label: 'Most Opened',
    description: 'Frequently accessed and top folders first',
    icon: Flame,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    badge: 'Default',
  },
  {
    id: 'name',
    label: 'Name (A - Z)',
    description: 'Alphabetical order from A to Z',
    icon: ArrowDownAZ,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'recently-added',
    label: 'Recently Added',
    description: 'Newest folders & models registered first',
    icon: Sparkles,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    id: 'oldest-added',
    label: 'Oldest Added',
    description: 'Earliest created items first',
    icon: Clock,
    color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
  },
];

export function getSortOptionDetails(sortBy: KbSortOption): SortOptionItem {
  return (
    KB_SORT_OPTIONS.find((opt) => opt.id === sortBy) || KB_SORT_OPTIONS[0]
  );
}

interface KbSortButtonProps {
  sortBy: KbSortOption;
  onClick: () => void;
  className?: string;
}

export function KbSortButton({ sortBy, onClick, className = '' }: KbSortButtonProps) {
  const current = getSortOptionDetails(sortBy);
  const CurrentIcon = current.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-violet-50/90 via-purple-50/60 to-indigo-50/80 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 border-1.5 border-violet-300 dark:border-violet-600/60 hover:border-violet-400 text-violet-950 dark:text-violet-100 text-xs font-black shadow-xs hover:shadow-md hover:shadow-violet-500/15 active:scale-95 transition-all duration-200 cursor-pointer group shrink-0 ${className}`}
      title="Change Sort Order"
    >
      <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
        <CurrentIcon className="w-3 h-3 text-white" />
      </div>
      <span className="font-black tracking-tight truncate">{current.label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 group-hover:text-violet-700 transition-transform group-hover:translate-y-0.5 ml-0.5" />
    </button>
  );
}

interface KbSortBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortBy: KbSortOption;
  onSortChange: (option: KbSortOption) => void;
  title?: string;
  subtitle?: string;
}

export function KbSortBottomSheet({
  open,
  onOpenChange,
  sortBy,
  onSortChange,
  title = 'Sort TV Brands',
  subtitle = 'Choose how manufacturer brands are ordered',
}: KbSortBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end items-center select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onOpenChange(false);
            }
          }}
        >
          {/* Backdrop Blur Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md -z-10 will-change-opacity cursor-pointer"
            onClick={() => onOpenChange(false)}
          />

          {/* iOS Style Bottom Sheet Page (Matching Add Brand) */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{
              y: '100%',
              transition: {
                duration: 0.22,
                ease: [0.32, 0, 0.67, 0],
              },
            }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 340,
              mass: 0.8,
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 320) {
                onOpenChange(false);
              }
            }}
            className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Indicator Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
            >
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
            </div>

            {/* Compact Native Sheet Header */}
            <div
              onPointerDown={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('button') || target?.closest('a')) return;
                dragControls.start(e);
              }}
              className="px-5 sm:px-6 pt-0.5 pb-3 border-b border-border/60 shrink-0 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600/20 via-purple-500/15 to-indigo-500/10 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-2xs shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground leading-tight truncate">
                      {title}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[240px] sm:max-w-[320px]">
                      {subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close sort menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sort Options Body */}
            <div className="p-4 sm:p-5 space-y-2 flex-1 overflow-y-auto no-scrollbar">
              {KB_SORT_OPTIONS.map((option) => {
                const isSelected = sortBy === option.id;
                const OptionIcon = option.icon;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                        try {
                          navigator.vibrate(25);
                        } catch {
                          // ignore vibration errors
                        }
                      }
                      onSortChange(option.id);
                      onOpenChange(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-2xl text-left transition-all duration-150 cursor-pointer border ${
                      isSelected
                        ? 'bg-violet-500/10 dark:bg-violet-950/30 border-violet-500/35 shadow-2xs'
                        : 'bg-muted/30 hover:bg-muted/60 border-transparent active:bg-muted/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${option.color}`}
                      >
                        <OptionIcon className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isSelected ? 'text-violet-700 dark:text-violet-300 font-extrabold' : 'text-foreground'
                            }`}
                          >
                            {option.label}
                          </span>
                          {option.badge && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] font-extrabold px-1.5 py-0 bg-muted text-muted-foreground border border-border/80"
                            >
                              {option.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </div>

                    {/* Selection Checkmark */}
                    <div className="shrink-0 flex items-center pl-2">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-border/80" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Integrated Sheet Footer (Matching Add Brand) */}
            <div className="px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-white/95 dark:bg-slate-900/95 flex items-center justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full h-11 rounded-2xl text-xs font-bold text-foreground border-border/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer"
              >
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
