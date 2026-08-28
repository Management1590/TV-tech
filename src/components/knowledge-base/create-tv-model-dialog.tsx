'use client';

import React, { useState, useTransition, useEffect, useId } from 'react';
import { Monitor, Loader2, Plus, Sparkles, CheckCircle2, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createTvModelAction } from '@/features/knowledge-base/actions/kb.actions';

interface CreateTvModelDialogProps {
  brands: { id: string; name: string }[];
  preselectedBrandId?: string;
  trigger?: React.ReactNode;
}

export function CreateTvModelDialog({
  brands,
  preselectedBrandId,
  trigger,
}: CreateTvModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [brandId, setBrandId] = useState(preselectedBrandId || brands[0]?.id || '');
  const [modelNumber, setModelNumber] = useState('');
  const [screenSize, setScreenSize] = useState('');
  const [autoDetectedSize, setAutoDetectedSize] = useState<string | null>(null);

  // Sync preselectedBrandId if prop changes
  useEffect(() => {
    if (preselectedBrandId) {
      setBrandId(preselectedBrandId);
    } else if (brands.length > 0 && !brandId) {
      setBrandId(brands[0].id);
    }
  }, [preselectedBrandId, brands, brandId]);

  // Selected brand object
  const selectedBrand = brands.find((b) => b.id === brandId);

  // Auto-detect starting 2 numeric digits for screen size
  const handleModelNumberChange = (value: string) => {
    setModelNumber(value);

    // Extract starting 2 numeric digits or the first 2-digit number sequence
    // Supports direct digits "55NU7100" -> "55", "32LM..." -> "32", or brand prefix "UA65..." -> "65"
    const cleaned = value.trim();
    const match = cleaned.match(/^(\d{2})/) || cleaned.match(/(?:^[a-zA-Z]{0,4}[-_]?)(\d{2})/);

    if (match && match[1]) {
      const detected = match[1];
      setScreenSize(detected);
      setAutoDetectedSize(detected);
    } else if (!cleaned) {
      setScreenSize('');
      setAutoDetectedSize(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !modelNumber.trim()) return;

    startTransition(async () => {
      const result = await createTvModelAction({
        brandId,
        modelNumber: modelNumber.trim().toUpperCase(),
        screenSize: screenSize.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Model "${modelNumber.trim().toUpperCase()}" created successfully`);
        setOpen(false);
        setModelNumber('');
        setScreenSize('');
        setAutoDetectedSize(null);
      } else {
        toast.error(result.error || 'Failed to create model');
      }
    });
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer group shrink-0"
        >
          <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Add Model</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={isPending ? undefined : setOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 bg-white/95 backdrop-blur-2xl border border-border/80 text-foreground shadow-2xl rounded-3xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header */}
            <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
                  <Monitor className="w-5 h-5" />
                </div>
                <span>Add TV Model</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedBrand ? (
                  <span>
                    Adding under brand{' '}
                    <strong className="text-foreground font-bold">{selectedBrand.name}</strong>. Screen
                    size is automatically populated from model digits.
                  </span>
                ) : (
                  <span>Register a new TV model number with automatic screen size detection.</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              {/* Optional Brand Selector (Only if multiple brands exist and not preselected) */}
              {!preselectedBrandId && brands.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="brand-select" className="text-xs font-semibold text-foreground">
                    Brand Category *
                  </Label>
                  <Select value={brandId} onValueChange={(v) => v && setBrandId(v)}>
                    <SelectTrigger id="brand-select" className="h-11 rounded-2xl bg-muted/50 border-border/80 text-sm">
                      <SelectValue placeholder="Select brand..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl bg-white border border-border shadow-xl">
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="cursor-pointer font-medium">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 1. Model Number Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="model-number" className="text-xs font-semibold text-foreground">
                    Model Number *
                  </Label>
                  {autoDetectedSize && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg animate-in fade-in">
                      <CheckCircle2 className="w-3 h-3" /> Auto-detected: {autoDetectedSize}&quot; Size
                    </span>
                  )}
                </div>
                <Input
                  id="model-number"
                  value={modelNumber}
                  onChange={(e) => handleModelNumberChange(e.target.value)}
                  placeholder="e.g. 55NU7100, 32LM563, OLED65C1"
                  required
                  autoFocus
                  disabled={isPending}
                  className="h-12 rounded-2xl bg-muted/50 hover:bg-white focus:bg-white border-border/80 text-sm sm:text-base font-bold tracking-wide transition-all focus-visible:ring-2 focus-visible:ring-primary/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  Type the full model code. The first 2 digits automatically calculate the TV screen size.
                </p>
              </div>

              {/* 2. TV Screen Size (Auto-filled) */}
              <div className="space-y-1.5">
                <Label htmlFor="screen-size" className="text-xs font-semibold text-foreground">
                  TV Size (Inches)
                </Label>
                <div className="relative flex items-center">
                  <Input
                    id="screen-size"
                    type="number"
                    min="10"
                    max="150"
                    value={screenSize}
                    onChange={(e) => {
                      setScreenSize(e.target.value);
                      setAutoDetectedSize(null); // User manually modified
                    }}
                    placeholder="e.g. 55"
                    disabled={isPending}
                    className="h-11 rounded-2xl bg-muted/50 hover:bg-white focus:bg-white border-border/80 text-sm font-bold pr-16 transition-all focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <div className="absolute right-3.5 text-xs font-bold text-muted-foreground pointer-events-none">
                    Inches (&quot;)
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-2xl text-xs h-10 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !brandId || !modelNumber.trim()}
                className="rounded-2xl text-xs h-10 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg active:scale-95 transition-all"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Model
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
