'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAutoSuggestedItemsAction, addItemToPurchaseListAction } from '@/features/purchase-manager/actions/purchase.actions';
import { toast } from 'sonner';
import { Loader2, Sparkles, Plus } from 'lucide-react';

interface AutoSuggestPanelProps {
  purchaseLists: { id: string; title: string }[];
}

export function AutoSuggestPanel({ purchaseLists }: AutoSuggestPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [selectedLists, setSelectedLists] = useState<Record<string, string>>({});

  const fetchSuggestions = () => {
    startTransition(async () => {
      const result = await getAutoSuggestedItemsAction();
      if (result.success) {
        setSuggestions(result.data);
        if (result.data?.length === 0) {
          toast.info('No suggestions right now. Stock levels look good!');
        }
      } else {
        toast.error(result.error || 'Failed to get suggestions');
      }
    });
  };

  const handleAddToList = (item: any) => {
    const listId = selectedLists[item.id];
    if (!listId) {
      toast.error('Please select a purchase list first');
      return;
    }

    setAddingItemId(item.id);
    startTransition(async () => {
      const result = await addItemToPurchaseListAction({
        purchaseListId: listId,
        itemId: item.id,
        itemName: item.name,
        description: item.description || (item.location ? `Loc: ${item.location}` : undefined),
        quantity: item.suggestedQty || 5,
      });

      if (result.success) {
        toast.success(`Added "${item.name}" to list`);
        setSuggestions((prev) => prev?.filter((s) => s.id !== item.id) || null);
      } else {
        toast.error(result.error || 'Failed to add item');
      }
      setAddingItemId(null);
    });
  };

  return (
    <Card className="rounded-3xl border border-border/80 bg-card shadow-2xs mb-6">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border">
        <div>
          <CardTitle className="text-base font-black flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Restock Suggestions (≤ 1 Unit & Out of Stock)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-detects items that are 0 in stock or have only 1 unit remaining
          </p>
        </div>
        <Button onClick={fetchSuggestions} disabled={isPending} variant="outline" size="sm" className="rounded-xl text-xs font-bold">
          {isPending && !addingItemId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />}
          {suggestions ? 'Refresh Suggestions' : 'Scan Inventory'}
        </Button>
      </CardHeader>

      {suggestions && (
        <CardContent className="pt-4">
          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">🎉 All stock levels are healthy! No items need restocking.</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-slate-50/80">
                  <div>
                    <h4 className="font-bold text-xs text-foreground">{item.name}</h4>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] bg-white">
                        In Stock: {item.quantity ?? '0'}
                      </Badge>
                      {item.isOutOfStock ? (
                        <Badge variant="destructive" className="text-[10px] py-0">Out of Stock</Badge>
                      ) : (
                        <Badge className="text-[10px] py-0 bg-amber-50 text-amber-700 border-amber-300">≤ 1 Remaining</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedLists[item.id] || ''}
                      onValueChange={(val: string | null) => { if (val) setSelectedLists((prev) => ({ ...prev, [item.id]: val })); }}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs bg-white rounded-xl">
                        <SelectValue placeholder="Select List..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border text-xs">
                        {purchaseLists.map((list) => (
                          <SelectItem key={list.id} value={list.id} className="text-xs">
                            {list.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => handleAddToList(item)}
                      disabled={addingItemId === item.id || !selectedLists[item.id]}
                    >
                      {addingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
