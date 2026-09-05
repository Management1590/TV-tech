'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
      className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-white dark:bg-slate-900 border border-border/80 hover:border-primary/40 text-foreground text-xs font-bold shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-200 cursor-pointer group shrink-0 ${className}`}
      title="Change Sort Order"
    >
      <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        <CurrentIcon className="w-3.5 h-3.5" />
      </div>
      <span className="font-extrabold tracking-tight truncate">{current.label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-y-0.5 ml-0.5" />
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
  title = 'Sort By',
  subtitle = 'Choose how items are ordered in this directory',
}: KbSortBottomSheetProps) {
  const [mounted, setMounted] = useState(false);

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
        <div className="fixed inset-0 z-[100] flex flex-col justify-end items-center select-none">
          {/* Backdrop Blur Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10 cursor-pointer"
            onClick={() => onOpenChange(false)}
          />

          {/* iOS Spring Slide-Up Sheet Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 340,
              mass: 0.85,
            }}
            className="relative z-10 w-full max-w-md p-3 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-2 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main Sheet Card */}
            <div className="bg-card rounded-[28px] border border-border shadow-2xl overflow-hidden flex flex-col">
              {/* iOS Grab Handle */}
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" />

              {/* Sheet Header */}
              <div className="px-5 pt-2 pb-3 border-b border-border/60 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-foreground tracking-tight flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <span>{title}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-7 h-7 rounded-full bg-muted/80 hover:bg-muted active:scale-90 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
                  aria-label="Close sort menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sort Options Table / List */}
              <div className="p-2 divide-y divide-border/40">
                {KB_SORT_OPTIONS.map((option) => {
                  const isSelected = sortBy === option.id;
                  const OptionIcon = option.icon;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onSortChange(option.id);
                        onOpenChange(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 shadow-xs'
                          : 'hover:bg-muted/60 active:bg-muted/80'
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
                              className={`text-sm font-bold truncate ${
                                isSelected ? 'text-primary' : 'text-foreground'
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
                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-border/80" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standalone iOS Style Done Button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full py-3.5 bg-card text-foreground font-extrabold text-sm rounded-2xl border border-border shadow-lg active:bg-muted active:scale-[0.98] transition-all text-center cursor-pointer"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
