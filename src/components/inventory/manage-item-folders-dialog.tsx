'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { FolderPlus, FolderOpen, Check, Loader2, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  getAllFoldersForLinkingAction,
  linkItemToFolderAction,
  unlinkItemFromFolderAction,
} from '@/features/inventory/actions/item.actions';

interface FolderEntry {
  id: string;
  name: string;
  materializedPath: string;
  depth: number;
  isLinked: boolean;
}

interface ManageItemFoldersDialogProps {
  itemId: string;
  itemName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageItemFoldersDialog({
  itemId,
  itemName,
  isOpen,
  onOpenChange,
}: ManageItemFoldersDialogProps) {
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getAllFoldersForLinkingAction(itemId).then((res) => {
        setIsLoading(false);
        if (res.success && res.folders) {
          setFolders(res.folders);
        }
      });
    }
  }, [isOpen, itemId]);

  const handleToggleLink = (folder: FolderEntry) => {
    setLoadingFolderId(folder.id);
    startTransition(async () => {
      if (folder.isLinked) {
        // Unlink
        const res = await unlinkItemFromFolderAction(itemId, folder.id);
        if (res.success) {
          toast.success(`Unlinked from "${folder.name}"`);
          setFolders((prev) =>
            prev.map((f) => (f.id === folder.id ? { ...f, isLinked: false } : f))
          );
        } else {
          toast.error(res.error || 'Failed to unlink item');
        }
      } else {
        // Link
        const res = await linkItemToFolderAction(itemId, folder.id);
        if (res.success) {
          toast.success(`Linked to "${folder.name}"`);
          setFolders((prev) =>
            prev.map((f) => (f.id === folder.id ? { ...f, isLinked: true } : f))
          );
        } else {
          toast.error(res.error || 'Failed to link item');
        }
      }
      setLoadingFolderId(null);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Link2 className="w-5 h-5 text-primary" />
            Link Item to Folders
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select which inventory folders <span className="font-semibold text-foreground">{itemName}</span> should be accessible from. An item can belong to multiple folders simultaneously without data duplication.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
              <span className="text-xs">Loading folders...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">No folders available.</div>
          ) : (
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
              {folders.map((folder) => {
                const isWorking = loadingFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      folder.isLinked
                        ? 'bg-primary/8 border-primary/30 text-foreground'
                        : 'bg-muted/40 border-border/60 text-foreground hover:border-border'
                    }`}
                    style={{ marginLeft: `${Math.min(folder.depth * 12, 48)}px` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen
                        className={`w-4 h-4 shrink-0 ${
                          folder.isLinked ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <span className="text-xs font-medium truncate">{folder.name}</span>
                    </div>

                    <Button
                      size="sm"
                      variant={folder.isLinked ? 'outline' : 'default'}
                      onClick={() => handleToggleLink(folder)}
                      disabled={isPending || isWorking}
                      className={`h-7 px-2.5 text-xs rounded-lg gap-1 ${
                        folder.isLinked
                          ? 'border-red-500/30 text-red-600 hover:bg-red-50 hover:text-red-300 hover:border-red-500/50'
                          : 'bg-primary hover:bg-primary text-foreground'
                      }`}
                    >
                      {isWorking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : folder.isLinked ? (
                        <>
                          <Unlink className="w-3 h-3 mr-0.5" />
                          Unlink
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3 h-3 mr-0.5" />
                          Link
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
