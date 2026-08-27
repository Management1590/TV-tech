'use client';

import { useState, useTransition } from 'react';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { recordStockMovementAction } from '@/features/inventory/actions/item.actions';

const MOVEMENT_TYPES = [
  { value: 'PURCHASE', label: 'Purchase (+)', color: 'text-emerald-600' },
  { value: 'SALE', label: 'Sale (−)', color: 'text-red-600' },
  { value: 'RETURN', label: 'Return (+)', color: 'text-primary' },
  { value: 'INTERNAL_USE', label: 'Internal Use (−)', color: 'text-amber-600' },
  { value: 'ADJUSTMENT', label: 'Adjustment (±)', color: 'text-amber-600' },
  { value: 'DAMAGE', label: 'Damage (−)', color: 'text-red-600' },
  { value: 'LOST', label: 'Lost (−)', color: 'text-red-600' },
] as const;

const POSITIVE_TYPES = ['PURCHASE', 'RETURN'];

interface StockMovementSheetProps {
  itemId: string;
  itemName: string;
  currentQuantity: number | null;
  trigger?: React.ReactNode;
}

export function StockMovementSheet({ itemId, itemName, currentQuantity, trigger }: StockMovementSheetProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [movementType, setMovementType] = useState<string>('PURCHASE');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const isPositive = POSITIVE_TYPES.includes(movementType);
  const quantityChange = isPositive ? quantity : -quantity;
  const newQuantity = (currentQuantity ?? 0) + quantityChange;

  const handleSubmit = () => {
    if (quantity <= 0) return;

    startTransition(async () => {
      const result = await recordStockMovementAction({
        itemId,
        movementType: movementType as any,
        quantityChange,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success('Stock movement recorded');
        setOpen(false);
        setQuantity(1);
        setNotes('');
      } else {
        toast.error(result.error || 'Failed to record movement');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-2">
            <ArrowDownUp className="h-4 w-4" /> Stock Movement
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Record Stock Movement</SheetTitle>
          <p className="text-sm text-muted-foreground">{itemName}</p>
        </SheetHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Movement Type</Label>
            <Select value={movementType} onValueChange={(v) => v && setMovementType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className={t.color}>{t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sm-qty">Quantity</Label>
            <Input
              id="sm-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sm-notes">Notes</Label>
            <Textarea
              id="sm-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              disabled={isPending}
            />
          </div>

          {/* Preview */}
          <div className="bg-muted/20 rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Preview</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">Current Qty</span>
              <span className="font-mono font-bold">{currentQuantity ?? '∞'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Change</span>
              <span className={`font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{quantityChange}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-sm font-medium">New Qty</span>
              <span className="font-mono font-bold text-lg">{Math.max(0, newQuantity)}</span>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || quantity <= 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Record Movement
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
