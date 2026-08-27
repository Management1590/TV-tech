'use client';

import React, { useState, useTransition } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { receiveStockAction } from '@/features/purchase-manager/actions/purchase.actions';
import { Loader2, PackageCheck } from 'lucide-react';

interface ReceiveStockSheetProps {
  purchaseListId: string;
  items: {
    id: string; // PurchaseListItem ID
    item: {
      id: string; // Actual Item ID
      name: string;
    };
    quantity: number;
    receivedQty: number;
  }[];
}

export function ReceiveStockSheet({ purchaseListId, items }: ReceiveStockSheetProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  const pendingItems = items.filter(i => i.quantity > i.receivedQty);

  const handleReceiveAll = () => {
    const newQts: Record<string, number> = {};
    pendingItems.forEach(i => {
      newQts[i.id] = i.quantity - i.receivedQty;
    });
    setReceivedQuantities(newQts);
  };

  const handleConfirm = () => {
    const payload = pendingItems.map(i => ({
      purchaseListItemId: i.id,
      itemId: i.item.id,
      receivedQty: receivedQuantities[i.id] || 0
    })).filter(i => i.receivedQty > 0);

    if (payload.length === 0) {
      toast.error('Enter at least one received quantity');
      return;
    }

    startTransition(async () => {
      const result = await receiveStockAction({
        purchaseListId,
        items: payload
      });

      if (result.success) {
        toast.success('Stock received successfully');
        setOpen(false);
        setReceivedQuantities({});
      } else {
        toast.error(result.error || 'Failed to receive stock');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <Button size="sm" variant="outline" className="text-xs h-8 border-emerald-500/30 text-emerald-500 hover:text-emerald-600">
          <PackageCheck className="h-4 w-4 mr-1" />
          Receive Stock
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Receive Stock</SheetTitle>
          <SheetDescription>
            Record the quantities received for this purchase order.
          </SheetDescription>
        </SheetHeader>

        {pendingItems.length === 0 ? (
          <div className="mt-8 text-center text-muted-foreground text-sm">
            All items in this list have been fully received.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={handleReceiveAll}>
                Receive All Pending
              </Button>
            </div>

            <div className="space-y-4">
              {pendingItems.map((pli) => {
                const remaining = pli.quantity - pli.receivedQty;
                return (
                  <div key={pli.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-muted/10">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pli.item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ordered: {pli.quantity} | Received: {pli.receivedQty} | Pending: {remaining}
                      </p>
                    </div>
                    <div className="w-24 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receivedQuantities[pli.id] ?? ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setReceivedQuantities(prev => ({
                            ...prev,
                            [pli.id]: isNaN(val) ? 0 : Math.min(val, remaining)
                          }));
                        }}
                        className="h-9"
                        placeholder="Qty"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={handleConfirm} disabled={isPending} className="w-full">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Receipt
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
