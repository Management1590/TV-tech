'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Check, X, Sparkles } from 'lucide-react';
import {
  useKeyboardViewport,
  useScrollLock,
  UnderKeyboardShield,
} from '@/lib/use-keyboard-viewport';

interface DocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; description: string }) => Promise<void>;
  initialData?: {
    id?: string;
    title: string;
    description: string;
  } | null;
  isSaving?: boolean;
}

export function DocumentDialog({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSaving = false,
}: DocumentDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const { isKeyboardOpen, offsetTop, viewportHeight, containerStyle } =
    useKeyboardViewport(isOpen);
  useScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '');
        // Strip basic HTML tags if stored as HTML
        const cleanDesc = (initialData.description || '')
          .replace(/<p>/gi, '')
          .replace(/<\/p>/gi, '\n')
          .replace(/<br\s*[\/]?>/gi, '\n')
          .trim();
        setDescription(cleanDesc);
      } else {
        setTitle('');
        setDescription('');
      }

      // Smooth auto-focus on the title input when dialog slides up
      const timer = setTimeout(() => {
        titleInputRef.current?.focus({ preventScroll: true });
      }, 90);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialData]);

  const handleClose = () => {
    if (isSaving) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    await onSave({
      title: title.trim(),
      description: description.trim(),
    });
  };

  const isEditMode = !!initialData?.id;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Under-Keyboard Solid Shield for Mobile Browsers */}
          <UnderKeyboardShield
            isKeyboardOpen={isKeyboardOpen}
            offsetTop={offsetTop}
            viewportHeight={viewportHeight}
          />

          {/* iOS Style Bottom Sheet Container */}
          <div
            className="fixed inset-x-0 z-[110] flex flex-col justify-end items-center select-none"
            style={containerStyle}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSaving) {
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10 cursor-pointer touch-none"
              onClick={() => {
                if (!isSaving) handleClose();
              }}
            />

            {/* Bottom Sheet Modal Card */}
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
                if ((info.offset.y > 80 || info.velocity.y > 320) && !isSaving) {
                  handleClose();
                }
              }}
              ref={sheetRef}
              style={{
                maxHeight: isKeyboardOpen ? '100%' : '90dvh',
                paddingBottom: isKeyboardOpen ? '32px' : undefined,
                marginBottom: isKeyboardOpen ? '-32px' : undefined,
              }}
              className="relative z-10 pointer-events-auto w-full max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-x border-border/80 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Indicator */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
              >
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
              </div>

              {/* Native Header Bar */}
              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (
                    target?.closest('button') ||
                    target?.closest('a') ||
                    target?.closest('input') ||
                    target?.closest('textarea')
                  )
                    return;
                  dragControls.start(e);
                }}
                className="px-5 sm:px-6 pt-0.5 pb-2.5 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-violet-600/15 via-purple-600/10 to-indigo-600/15 border border-violet-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-sm shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight truncate">
                      {isEditMode ? 'Edit Document Note' : 'Create New Document'}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      {isEditMode
                        ? 'Update the document heading and technical details'
                        : 'Add technical repair logs, voltage readings, or specs'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto px-5 sm:px-6 py-3.5 space-y-4 no-scrollbar flex-1">
                  {/* Document Heading Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/90 flex items-center justify-between">
                      <span>
                        Heading / Title <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                        Bolder & Standout
                      </span>
                    </label>
                    <Input
                      ref={titleInputRef}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Inverter 3.3V Specs"
                      disabled={isSaving}
                      className="h-11 rounded-2xl text-sm font-bold bg-muted/40 hover:bg-muted/60 focus:bg-background border-border/80 focus-visible:ring-2 focus-visible:ring-violet-500/25 focus-visible:border-violet-500 shadow-2xs placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:italic transition-all"
                    />
                  </div>

                  {/* Document Description Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground/90 flex items-center justify-between">
                      <span>Description & Technical Details</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Readable Body</span>
                    </label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Write your technical notes here..."
                      disabled={isSaving}
                      rows={5}
                      className="rounded-2xl text-sm leading-relaxed bg-muted/40 hover:bg-muted/60 focus:bg-background border-border/80 focus-visible:ring-2 focus-visible:ring-violet-500/25 focus-visible:border-violet-500 shadow-2xs resize-none min-h-[130px] max-h-[220px] placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:italic transition-all"
                    />
                    <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground/80">
                      <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" />
                      <span>
                        Tip: Include fault symptoms, voltages, component part numbers, or repair steps.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fixed Bottom Footer with Safe Area Insets */}
                <div
                  className={`px-5 sm:px-6 pt-2.5 border-t border-border/70 bg-white dark:bg-slate-900 flex items-center justify-end gap-2.5 shrink-0 ${
                    isKeyboardOpen ? 'pb-2.5' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
                  }`}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSaving}
                    className="rounded-xl sm:rounded-2xl h-9 sm:h-10 px-4 text-xs font-bold border-border/80 hover:bg-muted/60 cursor-pointer"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSaving || !title.trim()}
                    className="rounded-xl sm:rounded-2xl h-9 sm:h-10 px-5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-violet-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isEditMode ? 'Save Changes' : 'Create Document'}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
