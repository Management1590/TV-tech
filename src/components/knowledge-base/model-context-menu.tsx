'use client';

import React, { useState, useTransition, useMemo } from 'react';
import {
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Monitor,
  CheckCircle2,
  ArrowRight,
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
import { validateNameSimilarity } from '@/features/knowledge-base/utils/name-similarity-validator';

interface ModelContextMenuProps {
  modelId: string;
  modelNumber: string;
  screenSize?: number | null;
  brandName?: string;
  folderCount?: number;
  userRole?: string;
  existingModels?: string[];
}

export function ModelContextMenu({
  modelId,
  modelNumber,
  screenSize,
  brandName,
  folderCount = 0,
  userRole = 'STAFF',
  existingModels = [],
}: ModelContextMenuProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [newModelNumber, setNewModelNumber] = useState(modelNumber);
  const [newScreenSize, setNewScreenSize] = useState(screenSize ? String(screenSize) : '');
  const [autoDetectedSize, setAutoDetectedSize] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const isAdmin = !!userRole;

  // Filter out current model number from collision comparison
  const otherModels = useMemo(() => {
    return (existingModels || []).filter(
      (m) => m.trim().toUpperCase() !== modelNumber.trim().toUpperCase()
    );
  }, [existingModels, modelNumber]);

  // Real-time duplicate & similarity checking
  const similarityResult = useMemo(() => {
    if (!newModelNumber.trim() || otherModels.length === 0) {
      return { level: 'NONE' as const, hasConflict: false, hasWarning: false };
    }
    return validateNameSimilarity(newModelNumber, otherModels, 'Model');
  }, [newModelNumber, otherModels]);

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
    if (!newModelNumber.trim() || similarityResult.level === 'BLOCK') return;

    startTransition(async () => {
      const res = await renameTvModelAction(
        modelId,
        newModelNumber.trim().toUpperCase(),
        newScreenSize.trim() || undefined
      );

      if (res.success) {
        if (similarityResult.level === 'WARN_11') {
          toast.warning(`Model updated to "${newModelNumber.trim().toUpperCase()}" (11+ Match: ${similarityResult.conflictingName})`);
        } else if (similarityResult.level === 'WARN_8') {
          toast.warning(`Model updated to "${newModelNumber.trim().toUpperCase()}" (8+ Match: ${similarityResult.conflictingName})`);
        } else if (similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN') {
          toast.success(`Model updated to "${newModelNumber.trim().toUpperCase()}" (Similar to: ${similarityResult.conflictingName})`);
        } else {
          toast.success(`Model updated to "${newModelNumber.trim().toUpperCase()}"`);
        }
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
            e.stopPropagation();
          }}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer outline-none active:scale-95"
        >
          <MoreVertical className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-border/80 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {isAdmin && (
            <DropdownMenuItem
              onClick={() => setIsRenameOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-muted focus:bg-muted"
            >
              <Pencil className="w-3.5 h-3.5 text-primary" />
              <span>Rename Model</span>
            </DropdownMenuItem>
          )}

          {isAdmin && <DropdownMenuSeparator className="my-1 border-border/60" />}

          {isAdmin && (
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-red-600 focus:text-red-700 hover:bg-red-50 focus:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Model</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 1. RENAME TV MODEL DIALOG ── */}
      <Dialog open={isRenameOpen} onOpenChange={isPending ? undefined : setIsRenameOpen}>
        <DialogContent
          className="sm:max-w-[440px] p-4 sm:p-5 bg-white border border-border/80 text-foreground shadow-2xl rounded-3xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleRename} className="space-y-3.5">
            <DialogHeader className="space-y-0.5 pb-2 border-b border-border/60">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs">
                  <Pencil className="w-4 h-4" />
                </div>
                <span>Rename TV Model</span>
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground line-clamp-1">
                Update model number and screen size for {brandName || 'this brand'}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Model Number */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rename-model-num" className="text-xs font-semibold text-foreground">
                    Model Number *
                  </Label>
                  {autoDetectedSize && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {autoDetectedSize}&quot; Size
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
                  className={`h-10 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border text-sm font-bold tracking-wide transition-all focus-visible:ring-2 ${
                    similarityResult.level === 'BLOCK'
                      ? 'border-rose-400 focus-visible:ring-rose-400/40 text-rose-900 bg-rose-50/40'
                      : similarityResult.level === 'WARN_11'
                      ? 'border-2 border-red-600 focus-visible:ring-red-600/50 text-red-950 bg-red-100/40 font-black'
                      : similarityResult.level === 'WARN_8'
                      ? 'border-red-500 focus-visible:ring-red-500/30 text-red-900 bg-red-50/30'
                      : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN'
                      ? 'border-amber-400 focus-visible:ring-amber-400/40 text-foreground bg-amber-50/20'
                      : 'border-border/80 focus-visible:ring-primary/30'
                  }`}
                />

                {/* Exact Duplicate Match Restriction Banner */}
                {similarityResult.level === 'BLOCK' && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="font-bold text-rose-900 text-xs">Exact Duplicate Model</p>
                      <p className="text-[11px] text-rose-700 leading-tight">{similarityResult.message}</p>
                    </div>
                  </div>
                )}

                {/* 11+ Match Crazy Red Critical Warning Banner */}
                {similarityResult.level === 'WARN_11' && (
                  <div className="p-2.5 rounded-xl bg-red-600/10 border-2 border-red-600 text-red-950 text-xs flex items-start gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 fill-red-600 text-white shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-wider">
                          11+ Match Warning
                        </span>
                        <span className="font-bold text-xs truncate">&quot;{similarityResult.matchedSequence}&quot;</span>
                      </div>
                      <p className="text-[11px] text-red-900 leading-tight mt-0.5">
                        Matches model <strong className="font-extrabold text-red-950 underline">{similarityResult.conflictingName}</strong>. You may proceed if intended.
                      </p>
                    </div>
                  </div>
                )}

                {/* 8-10 Match Red Warning Banner */}
                {similarityResult.level === 'WARN_8' && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="font-bold text-red-900 text-xs">
                        8+ Match: &quot;{similarityResult.matchedSequence}&quot;
                      </p>
                      <p className="text-[11px] text-red-800 leading-tight">
                        Matches model <strong className="font-bold text-red-950">{similarityResult.conflictingName}</strong>. You may proceed if intended.
                      </p>
                    </div>
                  </div>
                )}

                {/* 5-7 Match Soft Amber Warning Banner */}
                {(similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN') && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="font-bold text-amber-900 text-xs">
                        Similar Model ({similarityResult.matchLength} Chars: &quot;{similarityResult.matchedSequence}&quot;)
                      </p>
                      <p className="text-[11px] text-amber-800 leading-tight">
                        Matches model <strong className="font-semibold text-amber-950">{similarityResult.conflictingName}</strong>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* TV Screen Size */}
              <div className="space-y-1">
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
                    className="h-10 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border-border/80 text-sm font-bold pr-16"
                  />
                  <div className="absolute right-3 text-xs font-bold text-muted-foreground pointer-events-none">
                    Inches (&quot;)
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameOpen(false)}
                disabled={isPending}
                className="rounded-xl text-xs h-9.5 px-3.5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !newModelNumber.trim() || similarityResult.level === 'BLOCK'}
                className={`rounded-xl text-xs h-9.5 px-4 text-white font-bold gap-1.5 shadow-sm transition-all cursor-pointer ${
                  similarityResult.level === 'WARN_11'
                    ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800 hover:from-red-600 hover:to-rose-600 shadow-md shadow-red-600/30 border border-red-400/40 font-black'
                    : similarityResult.level === 'WARN_8'
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-sm shadow-red-500/20'
                    : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN'
                    ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 shadow-sm shadow-amber-500/20'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary shadow-sm shadow-blue-500/20'
                }`}
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {similarityResult.level === 'WARN_11' ? (
                  <>
                    <span>Proceed & Save (11+ Match)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : similarityResult.level === 'WARN_8' ? (
                  <>
                    <span>Proceed & Save (8+ Match)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN' ? (
                  <>
                    <span>Proceed & Save Changes</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
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
            <div className="p-3 bg-muted/50 border border-border/80 rounded-2xl flex items-center justify-between text-xs">
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
