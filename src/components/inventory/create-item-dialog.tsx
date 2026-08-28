'use client';

import React, { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  PackagePlus,
  Loader2,
  Sliders,
  UploadCloud,
  ImagePlus,
  Trash2,
  Star,
  MapPin,
  Building2,
  FileText,
  TrendingUp,
  X,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createItemAction } from '@/features/inventory/actions/item.actions';
import { uploadMediaAction } from '@/features/media/actions/media.actions';
import { formatMoney } from '@/lib/config/currency';

export interface ParameterDefItem {
  id: string;
  name: string;
  valueType: string;
  unit?: string | null;
  isRequired?: boolean;
}

interface CreateItemDialogProps {
  folderId: string;
  parameterDefinitions?: ParameterDefItem[];
  trigger?: React.ReactNode;
}

interface SelectedImage {
  id: string;
  file: File;
  preview: string;
  isPrimary: boolean;
}

export function CreateItemDialog({
  folderId,
  parameterDefinitions = [],
  trigger,
}: CreateItemDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Core Item Fields
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [quantityMode, setQuantityMode] = useState<'UNKNOWN' | 'NUMERIC'>('UNKNOWN');
  const [quantity, setQuantity] = useState(0);

  // Supplier & Pricing
  const [supplierName, setSupplierName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  // Selected Images
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic parameter values state: { [parameterDefinitionId]: value }
  const [paramValues, setParamValues] = useState<Record<string, any>>({});

  // Margin calculation
  const numCost = parseFloat(costPrice) || 0;
  const numSelling = parseFloat(sellingPrice) || 0;
  const profit = numSelling - numCost;
  const marginPercent = numCost > 0 ? Math.round((profit / numCost) * 100) : 0;

  const handleParamChange = (defId: string, value: any) => {
    setParamValues((prev) => ({
      ...prev,
      [defId]: value,
    }));
  };

  // Handle Multi-file selection
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: SelectedImage[] = files.map((file, idx) => ({
      id: `${file.name}-${Date.now()}-${idx}`,
      file,
      preview: URL.createObjectURL(file),
      isPrimary: selectedImages.length === 0 && idx === 0, // First uploaded image becomes primary by default
    }));

    setSelectedImages((prev) => [...prev, ...newImages]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Set an image as primary
  const handleSetPrimary = (id: string) => {
    setSelectedImages((prev) =>
      prev.map((img) => ({
        ...img,
        isPrimary: img.id === id,
      }))
    );
  };

  // Remove an image
  const handleRemoveImage = (id: string) => {
    setSelectedImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      // If we removed the primary, designate the first remaining as primary
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Item name is required');
      return;
    }

    // Format parameter values
    const formattedParams = parameterDefinitions
      .map((def) => {
        const val = paramValues[def.id];
        if (val === undefined || val === null || val === '') return null;

        if (def.valueType === 'NUMBER') {
          const num = parseFloat(val);
          return isNaN(num) ? null : { parameterDefinitionId: def.id, valueNumber: num };
        }
        if (def.valueType === 'BOOLEAN') {
          return { parameterDefinitionId: def.id, valueBoolean: val === true || val === 'true' };
        }
        if (def.valueType === 'DATE') {
          return { parameterDefinitionId: def.id, valueDate: val };
        }
        return { parameterDefinitionId: def.id, valueText: String(val) };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    startTransition(async () => {
      setUploadStatus('Creating item in inventory...');

      // 1. Create item record
      const result = await createItemAction({
        name: name.trim(),
        folderId,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        quantityMode,
        quantity: quantityMode === 'NUMERIC' ? quantity : undefined,
        supplierName: supplierName.trim() || undefined,
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
        parameterValues: formattedParams.length > 0 ? formattedParams : undefined,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to create item');
        setUploadStatus('');
        return;
      }

      const entityId = result.data.entityId;

      // 2. Upload any selected images
      if (selectedImages.length > 0 && entityId) {
        // Upload primary first
        const sorted = [...selectedImages].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));

        for (let i = 0; i < sorted.length; i++) {
          const img = sorted[i];
          setUploadStatus(`Uploading image ${i + 1} of ${sorted.length} (${img.isPrimary ? 'Primary' : 'Gallery'})...`);

          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('entityId', entityId);
          formData.append('purpose', img.isPrimary ? 'PRIMARY' : 'GALLERY');

          try {
            await uploadMediaAction(formData);
          } catch (uploadErr) {
            console.error('Failed to upload image during creation:', uploadErr);
          }
        }
      }

      toast.success(
        selectedImages.length > 0
          ? `Item created successfully with ${selectedImages.length} image(s)!`
          : 'Item created successfully!'
      );

      setOpen(false);
      resetForm();
      router.refresh();
    });
  };

  const resetForm = () => {
    setName('');
    setLocation('');
    setNotes('');
    setQuantityMode('UNKNOWN');
    setQuantity(0);
    setSupplierName('');
    setCostPrice('');
    setSellingPrice('');
    setParamValues({});
    setSelectedImages([]);
    setUploadStatus('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : setOpen}>
      <DialogTrigger>
        {trigger || (
          <Button
            size="sm"
            className="group h-10 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground border border-primary shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 active:scale-95 cursor-pointer gap-2 shrink-0"
          >
            <PackagePlus className="h-4 w-4 text-primary-foreground shrink-0" />
            <span>New Item</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[660px] max-h-[92vh] overflow-y-auto bg-white/95 border-border text-foreground backdrop-blur-2xl p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Package className="w-4 h-4" />
            </div>
            Create New Item
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Add a new spare part to this folder with multiple photos, specifications, and initial pricing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* 1. Item Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Item Name <span className="text-red-600">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 55-inch UHD Power Supply Board LGP55-17UL6"
              autoFocus
              required
              disabled={isPending}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs h-10 focus-visible:ring-primary rounded-xl"
            />
          </div>

          {/* 2. MULTI-IMAGE ATTACHMENT SECTION */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-muted/60 border border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-primary" />
                Item Photos / Diagrams ({selectedImages.length})
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Supports unlimited 4K/8K images
              </span>
            </div>

            {/* Hidden Multi-file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFilesSelect}
              disabled={isPending}
              className="hidden"
            />

            {/* Drag & Drop / Click to select zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 bg-background/40 hover:bg-primary/5 group"
            >
              <UploadCloud className="w-8 h-8 mx-auto mb-1.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-xs font-semibold text-foreground group-hover:text-primary">
                Click or drop photos here to select multiple images
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                PNG, JPG, WEBP, HEIC — Select as many angles / board photos as needed
              </p>
            </div>

            {/* Selected Images Grid & Primary Selector */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1.5">
                {selectedImages.map((img) => (
                  <div
                    key={img.id}
                    className={`relative group rounded-xl overflow-hidden border-2 bg-background transition-all ${
                      img.isPrimary
                        ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10'
                        : 'border-border hover:border-border'
                    }`}
                  >
                    <div className="h-24 w-full overflow-hidden flex items-center justify-center p-1 bg-white">
                      <img
                        src={img.preview}
                        alt={img.file.name}
                        className="w-full h-full object-contain drop-shadow"
                      />
                    </div>

                    {/* Primary Star Pill */}
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(img.id)}
                      className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        img.isPrimary
                          ? 'bg-primary text-foreground shadow-md'
                          : 'bg-black/70 text-muted-foreground hover:text-foreground hover:bg-primary/80'
                      }`}
                      title={img.isPrimary ? 'Primary Showcase Image' : 'Click to set as Primary'}
                    >
                      <Star className={`w-2.5 h-2.5 ${img.isPrimary ? 'fill-current' : ''}`} />
                      {img.isPrimary ? 'Primary' : 'Set Main'}
                    </button>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      disabled={isPending}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-red-600/90 text-foreground opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-red-500 cursor-pointer shadow"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* File info footer */}
                    <div className="p-1 bg-muted/90 text-[10px] text-muted-foreground flex items-center justify-between border-t border-border">
                      <span className="truncate max-w-[65px]">{img.file.name}</span>
                      <span className="font-mono text-[9px] text-muted-foreground">{formatFileSize(img.file.size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Location & Quantity Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Label className="text-xs font-semibold text-foreground">Quantity Mode</Label>
              <Select
                value={quantityMode}
                onValueChange={(val) => val && setQuantityMode(val as 'UNKNOWN' | 'NUMERIC')}
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

          {/* Exact Count Input if NUMERIC */}
          {quantityMode === 'NUMERIC' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Label className="text-xs font-semibold text-primary">Initial In-Stock Quantity</Label>
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

          {/* 4. Initial Supplier & Pricing (Optional) */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-muted/60 border border-border">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              Initial Supplier & Pricing (Optional)
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-[11px] text-muted-foreground">Supplier Name</Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Delhi Electronics"
                  disabled={isPending}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xs h-9 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Cost Price (₹)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={isPending}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xs h-9 font-mono rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Selling Price (₹)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="0.00"
                  disabled={isPending}
                  className="bg-background border-border text-emerald-600 placeholder:text-muted-foreground text-xs h-9 font-mono font-bold rounded-lg"
                />
              </div>
            </div>

            {/* Profit margin preview */}
            {(numSelling > 0 || numCost > 0) && (
              <div className="p-2 rounded-lg bg-white/80 border border-border flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Est. Margin:
                </span>
                <span className="font-mono font-bold text-emerald-600">
                  +{formatMoney(profit)} ({marginPercent}%)
                </span>
              </div>
            )}
          </div>

          {/* 5. Notes / Specs */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Notes & Technical Specs
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 12V output, 8-pin connector, original panel spare..."
              rows={2}
              disabled={isPending}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs resize-none rounded-xl focus-visible:ring-primary"
            />
          </div>

          {/* 6. Dynamic Folder Parameters */}
          {parameterDefinitions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary" />
                  Category Technical Specifications ({parameterDefinitions.length})
                </Label>
                <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground">
                  Folder Defined
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {parameterDefinitions.map((param) => {
                  const val = paramValues[param.id] ?? '';
                  return (
                    <div key={param.id} className="space-y-1 bg-muted/60 p-2.5 rounded-xl border border-border">
                      <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span className="truncate">{param.name}</span>
                        {param.unit && <span className="text-muted-foreground text-[10px]">({param.unit})</span>}
                      </Label>

                      {param.valueType === 'BOOLEAN' ? (
                        <Select
                          value={val === true || val === 'true' ? 'true' : val === false || val === 'false' ? 'false' : ''}
                          onValueChange={(v) => handleParamChange(param.id, v === 'true' ? true : v === 'false' ? false : null)}
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
                      ) : param.valueType === 'NUMBER' ? (
                        <Input
                          type="number"
                          step="any"
                          value={val}
                          onChange={(e) => handleParamChange(param.id, e.target.value)}
                          placeholder={`Enter ${param.name.toLowerCase()}...`}
                          disabled={isPending}
                          className="bg-background border-border text-foreground text-xs h-8 rounded-lg focus-visible:ring-primary"
                        />
                      ) : param.valueType === 'DATE' ? (
                        <Input
                          type="date"
                          value={val}
                          onChange={(e) => handleParamChange(param.id, e.target.value)}
                          disabled={isPending}
                          className="bg-background border-border text-foreground text-xs h-8 rounded-lg focus-visible:ring-primary"
                        />
                      ) : (
                        <Input
                          type="text"
                          value={val}
                          onChange={(e) => handleParamChange(param.id, e.target.value)}
                          placeholder={`Enter ${param.name.toLowerCase()}...`}
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

          {/* Progress / Status feedback banner */}
          {uploadStatus && (
            <div className="p-3 rounded-xl bg-primary/8 border border-primary/30 text-xs text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />
              <span>{uploadStatus}</span>
            </div>
          )}

          {/* Dialog Footer */}
          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60">
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
              disabled={isPending || !name.trim()}
              className="bg-primary hover:bg-primary text-foreground text-xs h-10 px-6 rounded-xl font-bold shadow-[0_0_20px_rgba(59,130,246,0.35)]"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating Item...
                </>
              ) : selectedImages.length > 0 ? (
                `Create Item (${selectedImages.length} Photos)`
              ) : (
                'Create Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
