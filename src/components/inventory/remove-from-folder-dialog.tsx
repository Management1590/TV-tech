'use client';

import React, { useState } from 'react';
import { AlertCircle, FolderMinus, Loader2, X } from 'lucide-react';
import { unlinkItemFromFolderAction } from '@/features/inventory/actions/folder-item.actions';

interface RemoveFromFolderDialogProps {
  folderId: string;
  folderName: string;
  itemId: string;
  itemName: string;
  otherFoldersCount: number;
  isOpen: boolean;
  onClose: () => void;
  onItemRemoved?: () => void;
}

export const RemoveFromFolderDialog: React.FC<RemoveFromFolderDialogProps> = ({
  folderId,
  folderName,
  itemId,
  itemName,
  otherFoldersCount,
  isOpen,
  onClose,
  onItemRemoved,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRemoveSubmit = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    const result = await unlinkItemFromFolderAction(folderId, itemId);
    setIsLoading(false);

    if (result.success) {
      if (onItemRemoved) onItemRemoved();
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to remove link from folder');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card bg-muted border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-500/30 text-amber-600 flex items-center justify-center">
              <FolderMinus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Remove From Folder</h2>
              <p className="text-xs text-muted-foreground">Rule 4: Folder link removal</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-foreground">
            Are you sure you want to remove <span className="font-semibold text-foreground">"{itemName}"</span> from folder <span className="font-semibold text-foreground">"{folderName}"</span>?
          </p>

          <div className="p-4 rounded-2xl bg-white/80 border border-border space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>Item Entity Rule</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {otherFoldersCount > 0
                ? `This item will remain linked to ${otherFoldersCount} other folder(s). Removing this link does NOT delete the item or its stock records.`
                : `This is the item's only folder link. Removing it will unlink it from this folder, but the Item entity will continue to exist in Universal Search.`}
            </p>
          </div>

          {errorMsg ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-500/30 text-red-600 text-xs">
              {errorMsg}
            </div>
          ) : null}
        </div>

        <div className="p-4 bg-background border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            onClick={handleRemoveSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-foreground text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg transition"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderMinus className="w-4 h-4" />}
            <span>Remove Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};
