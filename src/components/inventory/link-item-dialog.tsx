'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Search, Link as LinkIcon, Package, X, Check, Loader2 } from 'lucide-react';
import { linkItemToFolderAction } from '@/features/inventory/actions/folder-item.actions';

interface LinkItemDialogProps {
  folderId: string;
  folderName: string;
  isOpen: boolean;
  onClose: () => void;
  onItemLinked?: () => void;
}

export const LinkItemDialog: React.FC<LinkItemDialogProps> = ({
  folderId,
  folderName,
  isOpen,
  onClose,
  onItemLinked,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSearch(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const itemResults = (data.results ?? []).filter((r: any) => r.entityType === 'ITEM');
          setResults(itemResults);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingSearch(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLinkSubmit = () => {
    if (!selectedItemId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await linkItemToFolderAction(folderId, selectedItemId);
      if (result.success) {
        setSuccessMsg(`Successfully linked item to "${folderName}" without duplication!`);
        if (onItemLinked) onItemLinked();
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
          setSearchQuery('');
          setResults([]);
          setSelectedItemId(null);
        }, 1500);
      } else {
        setErrorMsg(result.error || 'Failed to link item to folder');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card bg-muted border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Link Existing Item</h2>
              <p className="text-xs text-muted-foreground">Add an existing item to "{folderName}" (No duplication)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name or short code (#A9F2)..."
              className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Alert feedback */}
          {errorMsg ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-500/30 text-red-600 text-xs">
              {errorMsg}
            </div>
          ) : null}

          {successMsg ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          ) : null}

          {/* Results Candidate List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 relative min-h-[100px]">
            {isLoadingSearch && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            )}
            
            {searchQuery.length >= 2 && results.length === 0 && !isLoadingSearch && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No items found.
              </div>
            )}
            
            {results.map((item) => {
              const isSelected = selectedItemId === item.entityId;
              return (
                <div
                  key={item.entityId}
                  onClick={() => setSelectedItemId(item.entityId)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-foreground'
                      : 'bg-card border-border text-foreground hover:border-border'
                  }`}
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.subtitle && <span>{item.subtitle}</span>}
                    </div>
                  </div>

                  {item.shortCode && (
                    <span className="px-2 py-1 rounded bg-muted border border-border text-foreground font-mono text-xs font-semibold">
                      #{item.shortCode}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-background border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Item data & quantity remain shared</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              onClick={handleLinkSubmit}
              disabled={!selectedItemId || isPending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-foreground text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg transition"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              <span>Link to Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
