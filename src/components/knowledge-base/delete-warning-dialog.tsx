'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Trash2,
  X,
  FileText,
  Film,
  Mic,
  ImageIcon,
  Tv,
} from 'lucide-react';
import { IosSlideToConfirm } from '@/components/shared/ios-slide-to-confirm';
import { useScrollLock } from '@/lib/use-keyboard-viewport';

interface DeleteWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: string;
  itemName?: string;
  itemType?: 'photo / video' | 'voice recording' | 'document note' | 'backlight strip' | 'item' | string;
  isDeleting?: boolean;
}

export function DeleteWarningDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemType = 'item',
  isDeleting = false,
}: DeleteWarningDialogProps) {
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();

  useScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => {
    if (isDeleting) return;
    onClose();
  };

  const getItemIcon = () => {
    const typeLower = (itemType || '').toLowerCase();
    const nameLower = (itemName || '').toLowerCase();

    if (
      typeLower.includes('voice') ||
      typeLower.includes('audio') ||
      nameLower.endsWith('.webm') ||
      nameLower.endsWith('.mp3') ||
      nameLower.endsWith('.wav') ||
      nameLower.endsWith('.m4a') ||
      nameLower.endsWith('.ogg')
    ) {
      return <Mic className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    }
    if (
      nameLower.endsWith('.mp4') ||
      nameLower.endsWith('.mov') ||
      nameLower.endsWith('.webm') ||
      nameLower.endsWith('.avi') ||
      nameLower.endsWith('.mkv') ||
      typeLower.includes('video')
    ) {
      return <Film className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    }
    if (
      nameLower.endsWith('.jpg') ||
      nameLower.endsWith('.jpeg') ||
      nameLower.endsWith('.png') ||
      nameLower.endsWith('.webp') ||
      typeLower.includes('photo') ||
      typeLower.includes('image')
    ) {
      return <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
    if (typeLower.includes('document') || typeLower.includes('note') || typeLower.includes('spec')) {
      return <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    }
    if (typeLower.includes('backlight') || typeLower.includes('strip') || typeLower.includes('tv')) {
      return <Tv className="w-5 h-5 text-violet-600 dark:text-violet-400" />;
    }
    return <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />;
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[120] flex flex-col justify-end items-center select-none pointer-events-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              handleClose();
            }
          }}
        >
          {/* Soft Blurred Backdrop Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto cursor-pointer touch-none"
            onClick={handleClose}
          />

          {/* iOS Style Bottom Sheet Card */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{
              y: '100%',
              transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
            }}
            transition={{ type: 'spring', damping: 30, stiffness: 340, mass: 0.8 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if ((info.offset.y > 80 || info.velocity.y > 320) && !isDeleting) {
                handleClose();
              }
            }}
            className="pointer-events-auto relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-x border-border/80 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Indicator Handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
            >
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
            </div>

            {/* Header */}
            <div
              onPointerDown={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.closest('button') || target?.closest('a')) return;
                dragControls.start(e);
              }}
              className="px-5 sm:px-6 pt-0.5 pb-3 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-red-500/10 dark:bg-red-950/40 text-red-600 border border-red-500/20 dark:border-red-900/40 flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight leading-tight truncate">
                    {title}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate mt-0.5">
                    Permanent and irreversible action
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:px-6 space-y-3.5 flex-1 overflow-y-auto no-scrollbar">
              {/* Item Info Box */}
              {itemName && (
                <div className="p-3.5 bg-muted/40 dark:bg-slate-800/40 border border-border/70 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-background border border-border/80 flex items-center justify-center shrink-0 shadow-2xs">
                    {getItemIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate" title={itemName}>
                      {itemName}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                      {itemType}
                    </p>
                  </div>
                </div>
              )}

              {/* Warning Notice Card */}
              <div className="p-3.5 bg-red-50/70 dark:bg-red-950/25 border border-red-200/80 dark:border-red-900/50 rounded-2xl text-xs text-red-900 dark:text-red-300 font-medium leading-relaxed">
                {description || (
                  <>
                    Are you sure you want to permanently delete{' '}
                    <strong className="font-bold text-red-950 dark:text-red-100 break-words">
                      {itemName ? `"${itemName}"` : `this ${itemType}`}
                    </strong>
                    ? This action cannot be undone.
                  </>
                )}
              </div>
            </div>

            {/* Footer with iOS Slide to Confirm & Cancel */}
            <div className="px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-white/95 dark:bg-slate-900/95 flex flex-col gap-2.5 shrink-0">
              <IosSlideToConfirm
                onConfirm={onConfirm}
                isLoading={isDeleting}
                label="slide to permanently delete"
                loadingLabel="Deleting..."
                variant="danger"
              />

              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isDeleting}
                className="w-full h-10 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
