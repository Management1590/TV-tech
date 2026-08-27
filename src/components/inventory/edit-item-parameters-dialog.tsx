'use client';

import React, { useState, useTransition } from 'react';
import { Sliders, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { updateItemParametersAction } from '@/features/inventory/actions/item.actions';

export interface ParameterDefWithFolder {
  id: string;
  name: string;
  slug: string;
  valueType: string;
  unit?: string | null;
  folder?: { name: string } | null;
  inheritedFromFolderName?: string;
}

export interface CurrentParamValue {
  parameterDefinitionId: string;
  valueText?: string | null;
  valueNumber?: any;
  valueBoolean?: boolean | null;
  valueDate?: Date | string | null;
}

interface EditItemParametersDialogProps {
  itemId: string;
  itemName: string;
  definitions: ParameterDefWithFolder[];
  currentValues: CurrentParamValue[];
  trigger?: React.ReactNode;
}

export function EditItemParametersDialog({
  itemId,
  itemName,
  definitions,
  currentValues,
  trigger,
}: EditItemParametersDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Initialize values map from existing values
  const initValues = () => {
    const map: Record<string, any> = {};
    for (const def of definitions) {
      const match = currentValues.find((cv) => cv.parameterDefinitionId === def.id);
      if (match) {
        if (def.valueType === 'NUMBER') {
          map[def.id] = match.valueNumber !== null && match.valueNumber !== undefined ? String(match.valueNumber) : '';
        } else if (def.valueType === 'BOOLEAN') {
          map[def.id] = match.valueBoolean !== null && match.valueBoolean !== undefined ? match.valueBoolean : null;
        } else if (def.valueType === 'DATE') {
          map[def.id] = match.valueDate ? new Date(match.valueDate).toISOString().split('T')[0] : '';
        } else {
          map[def.id] = match.valueText || '';
        }
      } else {
        map[def.id] = def.valueType === 'BOOLEAN' ? null : '';
      }
    }
    return map;
  };

  const [values, setValues] = useState<Record<string, any>>(initValues);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setValues(initValues());
    }
    setOpen(isOpen);
  };

  const handleChange = (defId: string, val: any) => {
    setValues((prev) => ({
      ...prev,
      [defId]: val,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedList = definitions.map((def) => {
      const val = values[def.id];

      if (def.valueType === 'NUMBER') {
        const num = parseFloat(val);
        return {
          parameterDefinitionId: def.id,
          valueNumber: isNaN(num) ? null : num,
          valueText: null,
          valueBoolean: null,
          valueDate: null,
        };
      }
      if (def.valueType === 'BOOLEAN') {
        return {
          parameterDefinitionId: def.id,
          valueBoolean: val === true ? true : val === false ? false : null,
          valueText: null,
          valueNumber: null,
          valueDate: null,
        };
      }
      if (def.valueType === 'DATE') {
        return {
          parameterDefinitionId: def.id,
          valueDate: val ? String(val) : null,
          valueText: null,
          valueNumber: null,
          valueBoolean: null,
        };
      }
      return {
        parameterDefinitionId: def.id,
        valueText: val ? String(val).trim() : null,
        valueNumber: null,
        valueBoolean: null,
        valueDate: null,
      };
    });

    startTransition(async () => {
      const result = await updateItemParametersAction({
        itemId,
        parameterValues: formattedList,
      });

      if (result.success) {
        toast.success('Technical specifications updated successfully');
        setOpen(false);
      } else {
        toast.error(result.error || 'Failed to update specifications');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 border-border bg-muted/80 hover:bg-muted text-foreground">
            <Sliders className="w-3.5 h-3.5 text-primary" /> Edit Specs
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto bg-muted border-border text-foreground">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              Edit Technical Specifications
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update specification parameters for <span className="text-foreground font-medium">{itemName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {definitions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground bg-background/50 rounded-xl border border-border">
                No parameters defined in the item's folder yet. You can create folder parameters under folder options.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {definitions.map((def) => {
                  const val = values[def.id] ?? '';
                  const originFolder = def.inheritedFromFolderName || def.folder?.name;

                  return (
                    <div key={def.id} className="space-y-1.5 bg-card p-3 rounded-xl border border-border/60">
                      <Label className="text-xs text-foreground flex items-center justify-between">
                        <span className="font-semibold">{def.name}</span>
                        {def.unit && <span className="text-primary font-normal">({def.unit})</span>}
                      </Label>
                      {originFolder && (
                        <p className="text-[10px] text-muted-foreground truncate">From {originFolder}</p>
                      )}

                      {def.valueType === 'NUMBER' ? (
                        <Input
                          type="number"
                          step="any"
                          value={val}
                          onChange={(e) => handleChange(def.id, e.target.value)}
                          placeholder={`e.g. 12${def.unit ? ` ${def.unit}` : ''}`}
                          disabled={isPending}
                          className="h-9 text-sm bg-muted border-border text-foreground focus:border-primary"
                        />
                      ) : def.valueType === 'BOOLEAN' ? (
                        <Select
                          value={val === true ? 'true' : val === false ? 'false' : ''}
                          onValueChange={(v) =>
                            handleChange(def.id, v === 'true' ? true : v === 'false' ? false : null)
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-9 text-sm bg-muted border-border text-foreground">
                            <SelectValue placeholder="— Not set —" />
                          </SelectTrigger>
                          <SelectContent className="bg-muted border-border text-foreground">
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : def.valueType === 'DATE' ? (
                        <Input
                          type="date"
                          value={val}
                          onChange={(e) => handleChange(def.id, e.target.value)}
                          disabled={isPending}
                          className="h-9 text-sm bg-muted border-border text-foreground focus:border-primary"
                        />
                      ) : (
                        <Input
                          type="text"
                          value={val}
                          onChange={(e) => handleChange(def.id, e.target.value)}
                          placeholder={`Enter ${def.name.toLowerCase()}`}
                          disabled={isPending}
                          className="h-9 text-sm bg-muted border-border text-foreground focus:border-primary"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="border-border bg-transparent text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || definitions.length === 0}
              className="bg-primary hover:bg-primary text-foreground gap-1.5"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Specifications
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
