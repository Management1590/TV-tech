'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2, Sliders, MapPin, Tag, FileText, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { editItemAction } from '@/features/inventory/actions/item.actions';

export interface ParameterDefItem {
  id: string;
  name: string;
  valueType?: string | null;
  unit?: string | null;
  inheritedFromFolderName?: string;
}

interface EditItemDialogProps {
  item: {
    id: string;
    name: string;
    location?: string | null;
    notes?: string | null;
    quantityMode: string;
    quantity?: number | null;
    parameterValues?: Array<{
      parameterDefinitionId: string;
      valueText?: string | null;
      valueNumber?: any;
      valueBoolean?: boolean | null;
      valueDate?: string | null;
      parameterDefinition?: {
        id: string;
        name: string;
        unit?: string | null;
        valueType?: string | null;
      };
    }>;
  };
  definitions: ParameterDefItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditItemDialog({
  item,
  definitions = [],
  isOpen,
  onOpenChange,
}: EditItemDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(item.name);
  const [location, setLocation] = useState(item.location || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [quantityMode, setQuantityMode] = useState<'UNKNOWN' | 'NUMERIC'>(
    item.quantityMode === 'NUMERIC' ? 'NUMERIC' : 'UNKNOWN'
  );
  const [quantity, setQuantity] = useState<number>(item.quantity ?? 0);

  // Dynamic parameters state: { [defId]: value }
  const [paramValues, setParamValues] = useState<Record<string, any>>({});

  // Populate state when dialog opens or item changes
  useEffect(() => {
    if (isOpen) {
      setName(item.name);
      setLocation(item.location || '');
      setNotes(item.notes || '');
      setQuantityMode(item.quantityMode === 'NUMERIC' ? 'NUMERIC' : 'UNKNOWN');
      setQuantity(item.quantity ?? 0);

      const initialParams: Record<string, any> = {};
      if (item.parameterValues) {
        for (const pv of item.parameterValues) {
          const defId = pv.parameterDefinitionId || pv.parameterDefinition?.id;
          if (defId) {
            if (pv.valueText !== null && pv.valueText !== undefined) {
              initialParams[defId] = pv.valueText;
            } else if (pv.valueNumber !== null && pv.valueNumber !== undefined) {
              initialParams[defId] = pv.valueNumber;
            } else if (pv.valueBoolean !== null && pv.valueBoolean !== undefined) {
              initialParams[defId] = pv.valueBoolean ? 'true' : 'false';
            } else if (pv.valueDate) {
              initialParams[defId] = pv.valueDate;
            }
          }
        }
      }
      setParamValues(initialParams);
    }
  }, [isOpen, item]);

  const handleParamChange = (defId: string, value: any) => {
    setParamValues((prev) => ({
      ...prev,
      [defId]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Item name cannot be empty');
      return;
    }

    // Format parameter values
    const formattedParams = definitions.map((def) => {
      const val = paramValues[def.id];
      if (val === undefined || val === null || val === '') {
        return { parameterDefinitionId: def.id, valueText: null };
      }

      if (def.valueType === 'NUMBER') {
        const num = parseFloat(val);
        return {
          parameterDefinitionId: def.id,
          valueNumber: isNaN(num) ? null : num,
        };
      }
      if (def.valueType === 'BOOLEAN') {
        return {
          parameterDefinitionId: def.id,
          valueBoolean: val === true || val === 'true',
        };
      }
      if (def.valueType === 'DATE') {
        return {
          parameterDefinitionId: def.id,
          valueDate: val,
        };
      }
      return {
        parameterDefinitionId: def.id,
        valueText: String(val),
      };
    });

    startTransition(async () => {
      const result = await editItemAction({
        itemId: item.id,
        name: name.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        quantityMode,
        quantity: quantityMode === 'NUMERIC' ? Number(quantity) : null,
        parameterValues: formattedParams,
      });

      if (result.success) {
        toast.success('Item details updated successfully');
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update item');
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto bg-background border-border text-foreground shadow-2xl p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Pencil className="w-4 h-4" />
            </div>
            Edit Item Details
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update name, location, stock tracking, and technical specifications for{' '}
            <span className="text-primary font-semibold">"{item.name}"</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* 1. Item Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Item Name <span className="text-red-600">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 55-inch UHD Power Supply Board LGP55-17UL6"
              disabled={isPending}
              required
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs h-9.5 focus-visible:ring-primary rounded-xl"
            />
          </div>

          {/* 2. Location & Stock Tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Physical Location / Shelf
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Shelf A-3, Bin 12"
                disabled={isPending}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs h-9.5 focus-visible:ring-primary rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Quantity Tracking Mode</Label>
              <Select
                value={quantityMode}
                onValueChange={(val) => { if (val) setQuantityMode(val as 'UNKNOWN' | 'NUMERIC'); }}
                disabled={isPending}
              >
                <SelectTrigger className="bg-muted border-border text-foreground text-xs h-9.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value="UNKNOWN">Unknown / Uncounted (∞)</SelectItem>
                  <SelectItem value="NUMERIC">Exact Count (Numeric)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Exact Quantity when NUMERIC */}
          {quantityMode === 'NUMERIC' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-blue-950/20 border border-primary/20">
              <Label className="text-xs font-semibold text-primary">Current In-Stock Quantity</Label>
              <Input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={isPending}
                className="bg-muted border-border text-foreground text-xs h-9.5 focus-visible:ring-primary rounded-xl font-mono"
              />
            </div>
          )}

          {/* 3. Notes / Specs */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Notes & Pinout Description
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 12V / 24V output, 8-pin connector, compatible with 2022-2024 chassis..."
              rows={3}
              disabled={isPending}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs resize-none rounded-xl focus-visible:ring-primary"
            />
          </div>

          {/* 4. Folder-Specific Technical Specifications */}
          {definitions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary" />
                  Category Technical Specifications ({definitions.length})
                </Label>
                <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground">
                  Folder Defined
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {definitions.map((def) => {
                  const currentValue = paramValues[def.id] ?? '';

                  return (
                    <div key={def.id} className="space-y-1 bg-muted/60 p-2.5 rounded-xl border border-border">
                      <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span className="truncate">{def.name}</span>
                        {def.unit && <span className="text-muted-foreground text-[10px]">({def.unit})</span>}
                      </Label>

                      {def.valueType === 'BOOLEAN' ? (
                        <Select
                          value={currentValue === 'true' || currentValue === true ? 'true' : currentValue === 'false' || currentValue === false ? 'false' : ''}
                          onValueChange={(val) => handleParamChange(def.id, val)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="bg-background border-border text-foreground text-xs h-8 rounded-lg">
                            <SelectValue placeholder="Select Yes / No" />
                          </SelectTrigger>
                          <SelectContent className="bg-muted border-border text-foreground">
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : def.valueType === 'NUMBER' ? (
                        <Input
                          type="number"
                          step="any"
                          value={currentValue}
                          onChange={(e) => handleParamChange(def.id, e.target.value)}
                          placeholder={`Enter ${def.name.toLowerCase()}...`}
                          disabled={isPending}
                          className="bg-background border-border text-foreground text-xs h-8 rounded-lg focus-visible:ring-primary"
                        />
                      ) : def.valueType === 'DATE' ? (
                        <Input
                          type="date"
                          value={currentValue}
                          onChange={(e) => handleParamChange(def.id, e.target.value)}
                          disabled={isPending}
                          className="bg-background border-border text-foreground text-xs h-8 rounded-lg focus-visible:ring-primary"
                        />
                      ) : (
                        <Input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleParamChange(def.id, e.target.value)}
                          placeholder={`Enter ${def.name.toLowerCase()}...`}
                          disabled={isPending}
                          className="bg-background border-border text-foreground text-xs h-8 rounded-lg focus-visible:ring-primary"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="bg-primary hover:bg-primary text-foreground text-xs h-9 px-5 rounded-xl font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
