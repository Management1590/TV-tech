'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 sm:p-7 border border-red-200/80 shadow-2xl bg-white/98 backdrop-blur-xl">
        <DialogHeader className="space-y-3">
          {/* Warning Icon Badge */}
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-sm mx-auto sm:mx-0">
            <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
          </div>

          <div className="space-y-1 text-center sm:text-left">
            <DialogTitle className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description || (
                <>
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-foreground font-bold">
                    {itemName ? `"${itemName}"` : `this ${itemType}`}
                  </strong>
                  ? This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto rounded-2xl h-10 px-4 text-xs font-bold border-border/80"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full sm:w-auto rounded-2xl h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm gap-2 shadow-md shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Permanently</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
