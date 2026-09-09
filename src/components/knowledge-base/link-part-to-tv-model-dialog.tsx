'use client';

import React, { useState, useTransition } from 'react';
import { Search, Link2, Package, Loader2, Plus, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { linkItemToTvModelAction } from '@/features/knowledge-base/actions/kb.actions';

interface LinkPartToTvModelDialogProps {
  modelId: string;
  modelName: string;
}

export function LinkPartToTvModelDialog({ modelId, modelName }: LinkPartToTvModelDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setResults(items);
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = () => {
    if (!selectedItemId) return;

    startTransition(async () => {
      const res = await linkItemToTvModelAction(selectedItemId, modelId);
      if (res.success) {
        toast.success(`Spare part linked to ${modelName}`);
        setIsOpen(false);
        setSelectedItemId(null);
        setQuery('');
      } else {
        toast.error(res.error || 'Failed to link spare part');
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40">
          <Plus className="h-3.5 w-3.5" /> Link Spare Part
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md bg-background/95 backdrop-blur-xl border-border/60">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Link Spare Part to {modelName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search spare part name, short code, or location..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 text-xs h-9 focus-visible:ring-violet-500/25 focus-visible:border-violet-500"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {results.length === 0 && query.trim() && !isSearching && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No spare parts match &quot;{query}&quot;
              </p>
            )}

            {results.length === 0 && !query.trim() && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Type an item name or short code to find compatible spare parts
              </p>
            )}

            {results.map((item) => {
              const isSelected = selectedItemId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-medium'
                      : 'border-border/40 hover:border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortCode && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        #{item.shortCode}
                      </Badge>
                    )}
                    {isSelected && <Check className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedItemId || isPending}
              onClick={handleLink}
              className="text-xs h-8 gap-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-semibold shadow-xs shadow-violet-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Linking...
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" /> Link Compatibility
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
