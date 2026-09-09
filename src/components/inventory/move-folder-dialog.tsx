'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when dialog is active
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  return (
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[120] flex flex-col justify-end items-center select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPending) {
                onOpenChange(false);
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
                if (!isPending) onOpenChange(false);
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
                  onOpenChange(false);
                }
              }}
              className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden will-change-transform transform-gpu select-text"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
              </div>

              {/* Header */}
              <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <FolderInput className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                      Move Folder
                    </h2>
                    <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                      Relocate <span className="text-primary font-semibold">&ldquo;{folderName}&rdquo;</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPending) onOpenChange(false);
                  }}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search bar */}
              <div className="px-5 sm:px-6 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search destination folders..."
                    className="pl-9 pr-8 bg-muted border-border text-foreground placeholder:text-muted-foreground h-9 sm:h-10 focus-visible:ring-amber-500 text-xs sm:text-sm rounded-xl"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation Breadcrumb Bar */}
              <div className="px-5 sm:px-6 py-1.5 bg-muted/50 border-y border-border/60 flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={handleBackToRoot}
                    className={`flex items-center gap-1 hover:text-foreground transition-colors shrink-0 ${
                      browsingFolderId === null && !query ? 'text-primary font-semibold' : ''
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" /> Root
                  </button>

                  {folderHistory.map((h, i) => (
                    <React.Fragment key={h.id}>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <button
                        type="button"
                        onClick={() => {
                          const newHist = folderHistory.slice(0, i + 1);
                          setFolderHistory(newHist);
                          setBrowsingFolderId(h.id);
                        }}
                        className={`hover:text-foreground transition-colors truncate max-w-[100px] sm:max-w-[140px] shrink-0 ${
                          i === folderHistory.length - 1 && !query ? 'text-primary font-semibold' : ''
                        }`}
                      >
                        {h.name}
                      </button>
                    </React.Fragment>
                  ))}

                  {query && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-amber-600 font-medium truncate shrink-0">
                        &ldquo;{query}&rdquo;
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs">Finding available destination folders...</p>
                  </div>
                ) : (
                  <>
                    {/* Option: Move to Root Inventory Level (when not in search mode) */}
                    {!query && browsingFolderId === null && (
                      <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">Root Level (Top Directory)</h4>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                              Make top-level category in inventory tree
                            </p>
                          </div>
                        </div>

                        {currentFolderInfo?.isAtRoot ? (
                          <Badge variant="outline" className="text-muted-foreground border-border bg-card shrink-0 text-[10px]">
                            Already at Root
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleExecuteMove(null, 'Root Level')}
                            disabled={isPending}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-3 rounded-xl gap-1.5 shrink-0 shadow-xs"
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
                      <div className="text-center py-10 border border-dashed border-border rounded-2xl">
                        <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                          {query ? `No folders found matching "${query}"` : 'No sub-folders found in this category'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground/80 mt-1">
                          {query ? 'Try a different keyword or search query' : 'You can move the folder here or explore other categories'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
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
                              className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                isSelf || isDesc
                                  ? 'bg-muted/20 border-border opacity-60'
                                  : isParent
                                  ? 'bg-primary/5 border-primary/40'
                                  : 'bg-muted/40 border-border hover:border-border hover:bg-muted/70'
                              }`}
                            >
                              <div
                                className={`flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 ${
                                  folder.childCount > 0 && !isSelf && !isDesc ? 'cursor-pointer' : ''
                                }`}
                                onClick={() => {
                                  if (folder.childCount > 0 && !isSelf && !isDesc) {
                                    handleEnterFolder(folder);
                                  }
                                }}
                              >
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                    isParent
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  <Folder className="w-4 h-4" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm font-semibold text-foreground truncate hover:underline">
                                      {folder.name}
                                    </span>
                                    {folder.childCount > 0 && (
                                      <Badge variant="outline" className="text-[9px] sm:text-[10px] bg-muted border-border text-foreground px-1.5 py-0">
                                        {folder.childCount} sub
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                    Path: {folder.materializedPath} • {folder.itemCount} items
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isSelf && (
                                  <Badge variant="outline" className="text-[10px] sm:text-[11px] text-muted-foreground border-border bg-muted/40 gap-1">
                                    <Ban className="w-3 h-3" /> Same
                                  </Badge>
                                )}

                                {isDesc && (
                                  <Badge variant="outline" className="text-[10px] sm:text-[11px] text-amber-500/80 border-amber-900/40 bg-amber-950/20 gap-1">
                                    <Ban className="w-3 h-3" /> Sub-folder
                                  </Badge>
                                )}

                                {isParent && (
                                  <Badge variant="outline" className="text-[10px] sm:text-[11px] text-primary border-primary/60 bg-primary/8 gap-1">
                                    <Check className="w-3 h-3" /> Current
                                  </Badge>
                                )}

                                {folder.isValidDestination && (
                                  <Button
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => handleExecuteMove(folder.id, folder.name)}
                                    className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-3 rounded-xl gap-1.5 shadow-xs"
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
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEnterFolder(folder)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
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

              {/* iOS Footer with safe area padding */}
              <div className="px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1">
                  Updates all sub-folder paths automatically
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="h-9 text-xs rounded-xl px-4 shrink-0"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )
  );
}
