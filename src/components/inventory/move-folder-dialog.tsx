'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderInput,
  Search,
  FolderOpen,
  Folder,
  Check,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Home,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getFoldersForMoveAction,
  moveFolderAction,
} from '@/features/inventory/actions/folder.actions';

interface MoveFolderItem {
  id: string;
  name: string;
  description?: string | null;
  materializedPath: string;
  depth: number;
  parentId?: string | null;
  childCount: number;
  itemCount: number;
  isCurrent: boolean;
  isDescendant: boolean;
  isCurrentParent: boolean;
  isValidDestination: boolean;
  matchScore: number;
}

interface MoveFolderDialogProps {
  folderId: string;
  folderName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveFolderDialog({
  folderId,
  folderName,
  open,
  onOpenChange,
}: MoveFolderDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);

  const [folders, setFolders] = useState<MoveFolderItem[]>([]);
  const [currentFolderInfo, setCurrentFolderInfo] = useState<{
    id: string;
    name?: string;
    isAtRoot: boolean;
    parentId?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [movingTargetId, setMovingTargetId] = useState<string | null | 'ROOT'>(null);

  const [isPending, startTransition] = useTransition();

  // Load candidate destination folders
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(() => {
      getFoldersForMoveAction(folderId, query, browsingFolderId).then((res) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (res.success && res.folders) {
          setFolders(res.folders);
          if (res.currentFolder) {
            setCurrentFolderInfo(res.currentFolder);
          }
        }
      });
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [open, folderId, query, browsingFolderId]);

  const handleExecuteMove = (targetParentId: string | null, targetName: string) => {
    setMovingTargetId(targetParentId === null ? 'ROOT' : targetParentId);
    startTransition(async () => {
      const res = await moveFolderAction(folderId, targetParentId);
      if (res.success) {
        toast.success(`Folder "${folderName}" moved to "${targetName}"`);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to move folder');
      }
      setMovingTargetId(null);
    });
  };

  const handleEnterFolder = (folder: MoveFolderItem) => {
    setQuery('');
    setBrowsingFolderId(folder.id);
    setFolderHistory((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBackToRoot = () => {
    setQuery('');
    setBrowsingFolderId(null);
    setFolderHistory([]);
  };

  const handleBackStep = () => {
    setQuery('');
    if (folderHistory.length <= 1) {
      handleBackToRoot();
    } else {
      const newHist = folderHistory.slice(0, -1);
      setFolderHistory(newHist);
      setBrowsingFolderId(newHist[newHist.length - 1].id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[88dvh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0 bg-background border-border">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
            <FolderInput className="w-5 h-5 text-primary" />
            Move Folder: <span className="text-primary truncate">"{folderName}"</span>
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground">
            Select a target destination category or parent folder to relocate this entire tree.
          </DialogDescription>

          {/* Search bar */}
          <div className="relative mt-2 sm:mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search destination folders..."
              className="pl-9 bg-muted/90 border-border text-foreground placeholder:text-muted-foreground h-9 sm:h-10 focus-visible:ring-primary text-xs sm:text-sm rounded-xl"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Navigation Breadcrumb Bar */}
        <div className="px-4 sm:px-6 py-1.5 sm:py-2 bg-muted/60 border-b border-border/60 flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              onClick={handleBackToRoot}
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${
                browsingFolderId === null && !query ? 'text-primary font-semibold' : ''
              }`}
            >
              <Home className="w-3.5 h-3.5" /> Root
            </button>

            {folderHistory.map((h, i) => (
              <React.Fragment key={h.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <button
                  onClick={() => {
                    const newHist = folderHistory.slice(0, i + 1);
                    setFolderHistory(newHist);
                    setBrowsingFolderId(h.id);
                  }}
                  className={`hover:text-foreground transition-colors truncate max-w-[100px] sm:max-w-[140px] ${
                    i === folderHistory.length - 1 && !query ? 'text-primary font-semibold' : ''
                  }`}
                >
                  {h.name}
                </button>
              </React.Fragment>
            ))}

            {query && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="text-amber-600 font-medium truncate">
                  Search: &ldquo;{query}&rdquo;
                </span>
              </>
            )}
          </div>

          {(browsingFolderId !== null || query) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={query ? () => setQuery('') : handleBackStep}
              className="h-6 px-2 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            >
              <ArrowLeft className="w-3 h-3 mr-1" /> Back
            </Button>
          )}
        </div>

        {/* Folder Browser & Destination List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Finding available destination folders...</p>
            </div>
          ) : (
            <>
              {/* Option: Move to Root Inventory Level (when not in search mode) */}
              {!query && browsingFolderId === null && (
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Root Level (Top Directory)</h4>
                      <p className="text-xs text-muted-foreground">
                        Make "{folderName}" a top-level category in the inventory tree.
                      </p>
                    </div>
                  </div>

                  {currentFolderInfo?.isAtRoot ? (
                    <Badge variant="outline" className="text-muted-foreground border-border bg-card">
                      Already at Root
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleExecuteMove(null, 'Root Level')}
                      disabled={isPending}
                      className="bg-primary hover:bg-primary text-foreground font-medium text-xs gap-1.5"
                    >
                      {movingTargetId === 'ROOT' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Move to Root
                    </Button>
                  )}
                </div>
              )}

              {/* Sub-Folders List */}
              {folders.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-xl">
                  <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {query ? `No folders found matching "${query}"` : 'No sub-folders found in this category'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {query ? 'Try a different keyword or search query' : 'You can move the folder here or explore other categories'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {query ? `Search Results (${folders.length})` : 'Destination Folders'}
                  </div>

                  {folders.map((folder) => {
                    const isSelf = folder.isCurrent;
                    const isDesc = folder.isDescendant;
                    const isParent = folder.isCurrentParent;
                    const isMovingThis = movingTargetId === folder.id;

                    return (
                      <div
                        key={folder.id}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelf || isDesc
                            ? 'bg-muted/20 border-slate-900 opacity-60'
                            : isParent
                            ? 'bg-blue-950/20 border-blue-800/40'
                            : 'bg-muted/60 border-border hover:border-border hover:bg-muted/90'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-3 flex-1 min-w-0 ${
                            folder.childCount > 0 && !isSelf && !isDesc ? 'cursor-pointer' : ''
                          }`}
                          onClick={() => {
                            if (folder.childCount > 0 && !isSelf && !isDesc) {
                              handleEnterFolder(folder);
                            }
                          }}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isParent
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Folder className="w-4 h-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate hover:underline">
                                {folder.name}
                              </span>
                              {folder.childCount > 0 && (
                                <Badge variant="outline" className="text-[10px] bg-muted border-border text-foreground">
                                  {folder.childCount} sub-folders
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              Path: {folder.materializedPath} • {folder.itemCount} items
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isSelf && (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground border-border bg-muted/40 gap-1">
                              <Ban className="w-3 h-3" /> Same Folder
                            </Badge>
                          )}

                          {isDesc && (
                            <Badge variant="outline" className="text-[11px] text-amber-500/80 border-amber-900/40 bg-amber-950/20 gap-1">
                              <Ban className="w-3 h-3" /> Sub-folder (Invalid)
                            </Badge>
                          )}

                          {isParent && (
                            <Badge variant="outline" className="text-[11px] text-primary border-blue-800/60 bg-blue-950/40 gap-1">
                              <Check className="w-3 h-3" /> Current Location
                            </Badge>
                          )}

                          {folder.isValidDestination && (
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleExecuteMove(folder.id, folder.name)}
                              className="h-8 bg-primary hover:bg-primary text-foreground font-medium text-xs gap-1.5"
                            >
                              {isMovingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Move Here
                            </Button>
                          )}

                          {folder.childCount > 0 && !isSelf && !isDesc && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEnterFolder(folder)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Browse inside folder"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="p-4 px-6 border-t border-border/60 bg-muted/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Relocating a folder automatically updates all sub-folder paths and retains all linked items.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
