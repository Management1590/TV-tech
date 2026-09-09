'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tag, Loader2, Sparkles, Building2, Calendar, FileText, CheckCircle2, TrendingUp, Hash } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/config/currency';
import { addSupplierRecordAction } from '@/features/inventory/actions/item.actions';

interface AddSupplierRecordDialogProps {
  itemId: string;
  itemName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AddSupplierRecordDialog({
  itemId,
  itemName,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: AddSupplierRecordDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [isPending, startTransition] = useTransition();

  const [supplierName, setSupplierName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState('');

  // Calculations for live margin preview
  const numCost = parseFloat(costPrice) || 0;
  const numSelling = parseFloat(sellingPrice) || 0;
  const profit = numSelling - numCost;
  const marginPercent = numCost > 0 ? Math.round((profit / numCost) * 100) : 0;

  useEffect(() => {
    if (isOpen) {
      setSupplierName('');
      setCostPrice('');
      setSellingPrice('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error('Please provide a supplier name.');
      return;
    }

    startTransition(async () => {
      const result = await addSupplierRecordAction({
        itemId,
        supplierName: supplierName.trim(),
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
        purchaseDate: purchaseDate || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Price record registered with short code #${result.data?.shortCode}`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to add supplier record');
      }
    });
  };

  return (
    <>
      {trigger && (
        <div onClick={() => setOpen(true)} className="inline-block">
          {trigger}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={isPending ? undefined : setOpen}>
        {!isControlled && !trigger && (
          <DialogTrigger>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 h-9 text-xs border-border bg-muted/60 hover:bg-muted text-foreground rounded-xl"
            >
              <Tag className="h-4 w-4 text-primary" /> Add Price Record
            </Button>
          </DialogTrigger>
        )}

        <DialogContent className="sm:max-w-[480px] bg-white/95 border-border text-foreground backdrop-blur-2xl p-6 shadow-2xl rounded-2xl">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Tag className="w-4 h-4" />
              </div>
              Add Price Record & Short Code
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate max-w-[380px]">
              Register purchase cost, selling price, and supplier batch for{' '}
              <span className="text-primary font-semibold">"{itemName}"</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* 1. Supplier Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Supplier / Vendor Name <span className="text-red-600">*</span>
              </Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Delhi Electronics / Sharma Traders"
                required
                disabled={isPending}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs h-10 focus-visible:ring-primary rounded-xl"
              />
            </div>

            {/* 2. Cost & Selling Price Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Cost Price (₹)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={isPending}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs h-10 font-mono focus-visible:ring-primary rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Selling Price (₹)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={isPending}
                  className="bg-muted border-border text-emerald-600 placeholder:text-muted-foreground text-xs h-10 font-mono font-bold focus-visible:ring-emerald-500 rounded-xl"
                />
              </div>
            </div>

            {/* Live Margin Calculation Preview */}
            {(numSelling > 0 || numCost > 0) && (
              <div className="p-3 rounded-xl bg-muted/80 border border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Est. Profit & Margin:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                  </span>
                  {numCost > 0 && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        marginPercent >= 0
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-50 text-red-300 border-red-500/30'
                      }`}
                    >
                      {marginPercent}%
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* 3. Purchase Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Purchase Date
              </Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                disabled={isPending}
                className="bg-muted border-border text-foreground text-xs h-10 focus-visible:ring-primary rounded-xl"
              />
            </div>

            {/* 4. Remarks / Invoice / Batch Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Remarks / Invoice / Batch Reference
              </Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes or invoice number for this batch..."
                rows={2}
                disabled={isPending}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs resize-none rounded-xl focus-visible:ring-primary"
              />
            </div>

            {/* Short code info card */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary/90">
              <Hash className="w-4 h-4 text-primary shrink-0" />
              <span>
                A unique <strong>4-character short code</strong> (e.g. #FK5Y) will be auto-generated and added to the selector immediately.
              </span>
            </div>

            {/* Dialog Footer */}
            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !supplierName.trim()}
                className="bg-primary hover:bg-primary text-foreground text-xs h-10 px-5 rounded-xl font-bold shadow-[0_0_20px_rgba(59,130,246,0.35)]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Adding Record...
                  </>
                ) : (
                  'Save Price Record'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export aliases for compatibility
export const AddSupplierRecordSheet = AddSupplierRecordDialog;
