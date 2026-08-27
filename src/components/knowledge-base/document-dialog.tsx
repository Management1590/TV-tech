'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Sparkles, Check } from 'lucide-react';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

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
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onSave({
      title: title.trim(),
      description: description.trim(),
    });
  };

  const isEditMode = !!initialData?.id;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl rounded-3xl p-6 sm:p-7 border border-border/80 shadow-2xl bg-white/98 backdrop-blur-xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600/15 to-teal-600/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {isEditMode ? 'Edit Document Note' : 'Create New Document'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {isEditMode
                  ? 'Update the document heading and detailed technical description.'
                  : 'Add technical repair logs, voltage readings, fault specs, or diagnostic guides.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Document Heading Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Heading / Title <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-muted-foreground font-normal">Bolder & Standout</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Power Supply Inverter Standby 3.3V Fault Specs"
              autoFocus
              disabled={isSaving}
              className="h-11 rounded-2xl text-sm font-bold border-border/80 focus-visible:ring-emerald-500 shadow-2xs"
            />
          </div>

          {/* Document Description Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Description & Technical Details</span>
              <span className="text-[10px] text-muted-foreground font-normal">Readable Body</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter fault symptoms, voltage test measurements, replaced capacitor/IC numbers, diagnostic steps, or repair instructions..."
              disabled={isSaving}
              rows={6}
              className="rounded-2xl text-sm leading-relaxed border-border/80 focus-visible:ring-emerald-500 shadow-2xs resize-y min-h-[140px]"
            />
          </div>

          <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-2xl h-10 px-4 text-xs font-bold border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="rounded-2xl h-10 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
