'use client';

import React, { useState, useTransition } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [folderName, setFolderName] = useState('');
  const [isPending, startTransition] = useTransition();

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

      <Dialog open={open} onOpenChange={setOpen}>

      <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Create Folder under {modelNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Add a specialized section (e.g. &ldquo;Power Board&rdquo;, &ldquo;Main Board&rdquo;, &ldquo;Panel T-Con&rdquo;) with dedicated Photo/Video, Audio, and Text areas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="kb-folder-name" className="text-xs font-semibold text-foreground">
              Folder Name
            </Label>
            <Input
              id="kb-folder-name"
              placeholder="e.g. Power Supply Board"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              required
              className="h-11 rounded-xl bg-slate-50 border-border/80 text-sm"
              autoFocus
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !folderName.trim()}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold gap-2"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
  );
}
