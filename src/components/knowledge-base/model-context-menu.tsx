'use client';

import React, { useState, useTransition } from 'react';
import {
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Monitor,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  renameTvModelAction,
  deleteTvModelAction,
} from '@/features/knowledge-base/actions/kb.actions';

interface ModelContextMenuProps {
  modelId: string;
  modelNumber: string;
  screenSize?: number | null;
  brandName?: string;
  folderCount?: number;
  userRole?: string;
}

export function ModelContextMenu({
  modelId,
  modelNumber,
  screenSize,
  brandName,
  folderCount = 0,
  userRole = 'STAFF',
}: ModelContextMenuProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [newModelNumber, setNewModelNumber] = useState(modelNumber);
  const [newScreenSize, setNewScreenSize] = useState(screenSize ? String(screenSize) : '');
  const [autoDetectedSize, setAutoDetectedSize] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const isAdmin = !!userRole;

  React.useEffect(() => {
    if (isRenameOpen) {
      setNewModelNumber(modelNumber);
      setNewScreenSize(screenSize ? String(screenSize) : '');
      setAutoDetectedSize(null);
    }
  }, [isRenameOpen, modelNumber, screenSize]);

  // Auto-detect starting 2 numeric digits when renaming model number
  const handleModelNumberChange = (value: string) => {
    setNewModelNumber(value);

    const cleaned = value.trim();
    const match = cleaned.match(/^(\d{2})/) || cleaned.match(/(?:^[a-zA-Z]{0,4}[-_]?)(\d{2})/);

    if (match && match[1]) {
      const detected = match[1];
      setNewScreenSize(detected);
      setAutoDetectedSize(detected);
    } else if (!cleaned) {
      setNewScreenSize('');
      setAutoDetectedSize(null);
    }
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelNumber.trim()) return;

    startTransition(async () => {
      const res = await renameTvModelAction(
        modelId,
        newModelNumber.trim().toUpperCase(),
        newScreenSize.trim() || undefined
      );

      if (res.success) {
        toast.success(`Model updated to "${newModelNumber.trim().toUpperCase()}"`);
        setIsRenameOpen(false);
      } else {
        toast.error(res.error || 'Failed to rename model');
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTvModelAction(modelId);
      if (res.success) {
        toast.success(`Model "${modelNumber}" deleted successfully`);
        setIsDeleteOpen(false);
      } else {
        toast.error(res.error || 'Failed to delete model');
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Model options"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="h-8 w-8 inline-flex items-center justify-center rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-primary border border-border/80 hover:border-primary/40 shadow-2xs hover:shadow-md backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer z-20 group/btn"
        >
          <MoreVertical className="h-4 w-4 transition-transform group-hover/btn:scale-110" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56 rounded-2xl bg-white border border-border/80 shadow-xl p-1.5 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={() => setIsRenameOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-slate-100"
          >
            <Pencil className="w-3.5 h-3.5 text-blue-600" />
            <span>Rename Model</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-border/60" />

          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Model</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 1. RENAME TV MODEL DIALOG ── */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent
          className="sm:max-w-[460px] p-6 bg-white/95 backdrop-blur-2xl border border-border/80 text-foreground shadow-2xl rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleRename} className="space-y-4">
            <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600/15 to-indigo-600/15 border border-blue-600/25 flex items-center justify-center text-blue-600 shadow-sm">
                  <Pencil className="w-4.5 h-4.5" />
                </div>
                <span>Rename TV Model</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update model number and screen size for {brandName || 'this brand'}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-1">
              {/* Model Number */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rename-model-num" className="text-xs font-semibold text-foreground">
                    Model Number *
                  </Label>
                  {autoDetectedSize && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg animate-in fade-in">
                      <CheckCircle2 className="w-3 h-3" /> Auto-detected: {autoDetectedSize}&quot; Size
                    </span>
                  )}
                </div>
                <Input
                  id="rename-model-num"
                  value={newModelNumber}
                  onChange={(e) => handleModelNumberChange(e.target.value)}
                  placeholder="e.g. 55NU7100"
                  required
                  autoFocus
                  disabled={isPending}
                  className="h-11 rounded-2xl bg-slate-50/90 hover:bg-white focus:bg-white border-border/80 text-sm font-bold tracking-wide"
                />
              </div>

              {/* TV Screen Size */}
              <div className="space-y-1.5">
                <Label htmlFor="rename-screen-size" className="text-xs font-semibold text-foreground">
                  TV Size (Inches)
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="rename-screen-size"
                    type="number"
                    min="10"
                    max="150"
                    value={newScreenSize}
                    onChange={(e) => {
                      setNewScreenSize(e.target.value);
                      setAutoDetectedSize(null);
                    }}
                    placeholder="e.g. 55"
                    disabled={isPending}
                    className="h-11 rounded-2xl bg-slate-50/90 hover:bg-white focus:bg-white border-border/80 text-sm font-bold pr-16"
                  />
                  <div className="absolute right-3.5 text-xs font-bold text-muted-foreground pointer-events-none">
                    Inches (&quot;)
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameOpen(false)}
                disabled={isPending}
                className="rounded-2xl text-xs h-10 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !newModelNumber.trim()}
                className="rounded-2xl text-xs h-10 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold gap-2 shadow-md shadow-blue-500/20"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── 2. DELETE TV MODEL DIALOG WITH WARNING ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          className="sm:max-w-[460px] p-6 bg-white/95 backdrop-blur-2xl border border-red-200/80 text-foreground shadow-2xl rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span>Delete TV Model</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please review the consequences of deleting this TV model.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Warning Callout */}
            <div className="p-3.5 rounded-2xl bg-red-50/90 border border-red-200/90 flex items-start gap-3 text-red-950">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold">This action is permanent and cannot be undone.</p>
                <p className="text-red-800 leading-relaxed">
                  Deleting model <strong className="font-bold text-red-950">{modelNumber}</strong> will permanently remove all associated technical folders, schematics, backlight compatibility links, and service logs.
                </p>
              </div>
            </div>

            {/* Model Summary Badge */}
            <div className="p-3 bg-slate-50 border border-border/80 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-4 h-4 text-primary" />
                <span className="font-bold text-foreground">{modelNumber}</span>
                {screenSize && (
                  <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-white">
                    {screenSize}&quot;
                  </Badge>
                )}
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {folderCount} {folderCount === 1 ? 'Folder' : 'Folders'} Attached
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
              className="rounded-2xl text-xs h-10 px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-2xl text-xs h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 shadow-md shadow-red-500/20"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete Model Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
