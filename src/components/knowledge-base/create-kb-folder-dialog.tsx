'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { FolderPlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createKnowledgeFolderAction } from '@/features/knowledge-base/actions/kb-folder.actions';

interface CreateKbFolderDialogProps {
  modelId: string;
  modelNumber: string;
}

export function CreateKbFolderDialog({ modelId, modelNumber }: CreateKbFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isPending, startTransition] = useTransition();
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
  }, []);

  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  // Track visualViewport for mobile virtual keyboard height so bottom sheet docks directly on top of keyboard
  useEffect(() => {
    if (!open) {
      setKeyboardHeight(0);
      return;
    }

    const updateKeyboard = () => {
      if (typeof window === 'undefined') return;
      const vv = window.visualViewport;
      if (vv) {
        const offsetFromBottom = window.innerHeight - (vv.height + vv.offsetTop);
        const kbHeight = offsetFromBottom > 60 ? Math.round(offsetFromBottom) : 0;
        setKeyboardHeight(kbHeight);
      }
    };

    updateKeyboard();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateKeyboard);
      vv.addEventListener('scroll', updateKeyboard);
    }
    window.addEventListener('resize', updateKeyboard);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateKeyboard);
        vv.removeEventListener('scroll', updateKeyboard);
      }
      window.removeEventListener('resize', updateKeyboard);
    };
  }, [open]);

  // Lock body scroll on iOS without letting window.scrollY displace fixed overlays
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const prevPosition = document.body.style.position;
      const prevTop = document.body.style.top;
      const prevWidth = document.body.style.width;
      const prevOverflow = document.body.style.overflow;

      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = prevPosition;
        document.body.style.top = prevTop;
        document.body.style.width = prevWidth;
        document.body.style.overflow = prevOverflow;
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    startTransition(async () => {
      const res = await createKnowledgeFolderAction(modelId, folderName.trim());
      if (res.success) {
        toast.success(`Folder "${folderName.trim()}" created successfully`);
        setFolderName('');
        setOpen(false);
      } else {
        toast.error(res.error || 'Failed to create folder');
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold text-xs gap-2 shadow-sm shadow-violet-500/20 cursor-pointer"
      >
        <FolderPlus className="w-4 h-4" />
        Add Folder
      </Button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                className="fixed inset-0 z-[100] flex flex-col justify-end items-center select-none"
                style={{
                  bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : 0,
                  transition: 'bottom 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    setOpen(false);
                  }
                }}
              >
                {/* Backdrop Blur Layer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer"
                  onClick={() => {
                    if (!isPending) setOpen(false);
                  }}
                />

                {/* iOS Bottom Sheet */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
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
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      setOpen(false);
                    }
                  }}
                  style={{
                    maxHeight: keyboardHeight > 0 ? `calc(100svh - ${keyboardHeight + 16}px)` : '90dvh',
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag Handle */}
                  <div
                    onPointerDown={(e) => dragControls.start(e)}
                    className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
                  >
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div
                    onPointerDown={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest('button') || target?.closest('a') || target?.closest('input')) return;
                      dragControls.start(e);
                    }}
                    className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <FolderPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          Create Folder
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          Under model {modelNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPending) setOpen(false);
                      }}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form Body */}
                  <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar flex-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="kb-folder-name" className="text-xs font-semibold text-foreground">
                          Folder Name *
                        </Label>
                        <Input
                          id="kb-folder-name"
                          placeholder="e.g. Power Supply Board, Main Board, Panel T-Con"
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          required
                          className="h-11 rounded-xl bg-muted/50 border-border/80 text-sm font-semibold focus-visible:ring-violet-500/25 focus-visible:border-violet-500"
                          autoFocus
                          disabled={isPending}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Add a specialized technical section with dedicated media, audio recordings, and notes.
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div
                      className={`px-5 sm:px-6 pt-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0 ${
                        keyboardHeight > 0 ? 'pb-2.5' : 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                        className="rounded-xl text-xs h-9.5 px-3.5"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending || !folderName.trim()}
                        className="rounded-xl text-xs h-9.5 px-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 font-bold gap-2 shadow-md shadow-violet-500/20 text-white active:scale-95 transition-all"
                      >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Create Folder
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
