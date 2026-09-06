'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
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
        className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 shadow-sm cursor-pointer"
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
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.2 }}
                  onDragEnd={(_, info) => {
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      setOpen(false);
                    }
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
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
                          className="h-11 rounded-xl bg-muted/50 border-border/80 text-sm font-semibold"
                          autoFocus
                          disabled={isPending}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Add a specialized technical section with dedicated media, audio recordings, and notes.
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
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
                        className="rounded-xl text-xs h-9.5 px-4 bg-primary hover:bg-primary/90 font-semibold gap-2 shadow-sm text-primary-foreground"
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
