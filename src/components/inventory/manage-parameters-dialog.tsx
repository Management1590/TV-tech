'use client';

import { useState, useTransition, useEffect } from 'react';
import { Settings2, Loader2, Plus, Tag, Trash2, Globe, FolderOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  createParameterDefinitionAction,
  deleteParameterDefinitionAction,
} from '@/features/inventory/actions/folder.actions';
import { Badge } from '@/components/ui/badge';

export interface Parameter {
  id: string;
  name: string;
  slug: string;
  valueType: string;
  unit: string | null;
  isRequired: boolean;
}

export interface FolderOption {
  id: string;
  name: string;
  parameterDefinitions?: Parameter[];
}

interface ManageParametersDialogProps {
  folderId?: string;
  folderName?: string;
  existingParameters?: Parameter[];
  universalParameters?: Parameter[];
  folders?: FolderOption[];
}

export function ManageParametersDialog({
  folderId,
  folderName,
  existingParameters = [],
  universalParameters = [],
  folders,
}: ManageParametersDialogProps) {
  const [open, setOpen] = useState(false);

  // If in main inventory mode, default to 'UNIVERSAL'
  const isMainInventory = !folderId;
  const [selectedScope, setSelectedScope] = useState<string>(
    folderId || 'UNIVERSAL'
  );

  const isUniversalActive = selectedScope === 'UNIVERSAL';
  const activeFolder = folders?.find((f) => f.id === selectedScope);
  const activeScopeName = isUniversalActive
    ? 'Universal (All Folders)'
    : folderName || activeFolder?.name || 'Folder';

  const [parametersList, setParametersList] = useState<Parameter[]>(
    folderId
      ? existingParameters
      : isUniversalActive
      ? universalParameters
      : activeFolder?.parameterDefinitions || []
  );

  const [name, setName] = useState('');
  const [valueType, setValueType] = useState<string | null>('TEXT');
  const [unit, setUnit] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync state when props or selected scope changes
  useEffect(() => {
    if (folderId) {
      setParametersList(existingParameters);
    } else if (selectedScope === 'UNIVERSAL') {
      setParametersList(universalParameters);
    } else {
      const target = folders?.find((f) => f.id === selectedScope);
      setParametersList(target?.parameterDefinitions || []);
    }
  }, [existingParameters, universalParameters, folderId, folders, selectedScope]);

  const handleScopeChange = (newScope: string | null) => {
    if (!newScope) return;
    setSelectedScope(newScope);
    if (newScope === 'UNIVERSAL') {
      setParametersList(universalParameters);
    } else {
      const target = folders?.find((f) => f.id === newScope);
      setParametersList(target?.parameterDefinitions || []);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !valueType) {
      toast.error('Please enter a parameter name.');
      return;
    }

    const targetFolderId = isUniversalActive ? null : selectedScope;

    startTransition(async () => {
      const result = await createParameterDefinitionAction({
        folderId: targetFolderId,
        name: name.trim(),
        valueType,
        unit: unit.trim() || undefined,
        isRequired,
      });

      if (result.success) {
        toast.success(
          isUniversalActive
            ? `Universal parameter "${name.trim()}" created (applies to all folders)`
            : `Parameter "${name.trim()}" added to ${activeScopeName}`
        );

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const newParam: Parameter = {
          id: `temp-${Date.now()}`,
          name: name.trim(),
          slug,
          valueType,
          unit: unit.trim() || null,
          isRequired,
        };

        setParametersList((prev) => [...prev, newParam]);

        if (isUniversalActive) {
          universalParameters.push(newParam);
        } else if (activeFolder) {
          activeFolder.parameterDefinitions = [
            ...(activeFolder.parameterDefinitions || []),
            newParam,
          ];
        }

        setName('');
        setValueType('TEXT');
        setUnit('');
        setIsRequired(false);
      } else {
        toast.error(result.error || 'Failed to create parameter');
      }
    });
  };

  const handleDelete = (param: Parameter) => {
    setDeletingId(param.id);
    startTransition(async () => {
      const result = await deleteParameterDefinitionAction(param.id);

      if (result.success) {
        toast.success(`Parameter "${param.name}" deleted`);
        setParametersList((prev) => prev.filter((p) => p.id !== param.id));
        if (isUniversalActive) {
          const idx = universalParameters.findIndex((p) => p.id === param.id);
          if (idx !== -1) universalParameters.splice(idx, 1);
        } else if (activeFolder && activeFolder.parameterDefinitions) {
          activeFolder.parameterDefinitions = activeFolder.parameterDefinitions.filter(
            (p) => p.id !== param.id
          );
        }
      } else {
        toast.error(result.error || 'Failed to delete parameter');
      }
      setDeletingId(null);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm bg-white hover:bg-muted border border-border/90 text-foreground hover:border-primary/40 hover:text-primary shadow-xs transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
        >
          {isMainInventory ? (
            <Globe className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Settings2 className="h-4 w-4 text-primary shrink-0" />
          )}
          <span>
            {isMainInventory ? (
              <>
                <span className="inline sm:hidden">Parameters</span>
                <span className="hidden sm:inline">Universal Parameters</span>
              </>
            ) : (
              'Manage Parameters'
            )}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {isUniversalActive ? (
              <Globe className="w-5 h-5 text-primary" />
            ) : (
              <Settings2 className="w-5 h-5 text-primary" />
            )}
            {isUniversalActive ? 'Universal Parameters' : 'Folder Parameters'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {isUniversalActive
              ? 'Universal parameters are global specifications automatically inherited by ALL items created across ALL folders in your inventory.'
              : `Parameters defined here are inherited by all items in ${activeScopeName} and its sub-folders.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Scope / Folder Selector (When on Main Inventory) */}
          {isMainInventory && (
            <div className="space-y-1.5 p-3 rounded-2xl bg-muted/70 border border-border">
              <Label className="text-xs text-foreground font-semibold flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                Select Scope / Target:
              </Label>
              <Select value={selectedScope} onValueChange={handleScopeChange}>
                <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground rounded-xl">
                  <SelectValue placeholder="Choose a scope" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground text-xs max-h-[240px]">
                  <SelectItem value="UNIVERSAL" className="font-semibold text-primary">
                    🌍 Universal Scope (Applies to all folders & items)
                  </SelectItem>
                  {folders && folders.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Specific Folders
                      </div>
                      {folders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          📁 {f.name} ({f.parameterDefinitions?.length || 0} params)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Defined Parameters List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {isUniversalActive ? (
                  <Sparkles className="w-4 h-4 text-primary" />
                ) : (
                  <Tag className="w-4 h-4 text-primary" />
                )}
                {isUniversalActive ? 'Universal Parameters' : `Parameters in ${activeScopeName}`}
              </h3>
              <Badge
                variant="secondary"
                className={
                  isUniversalActive
                    ? 'bg-primary/10 text-primary border-primary/20 text-[10px] px-2 py-0.5'
                    : 'bg-muted text-foreground text-[10px] px-2 py-0.5'
                }
              >
                {parametersList.length} parameter{parametersList.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {parametersList.length === 0 ? (
              <div className="p-4 rounded-xl bg-card border border-border text-center text-xs text-muted-foreground">
                {isUniversalActive
                  ? 'No universal parameters defined yet. Add one below to apply it across all folders.'
                  : `No parameters defined for ${activeScopeName} yet. Add one below.`}
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {parametersList.map((param) => (
                  <div
                    key={param.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/40 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Tag className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{param.name}</p>
                          {isUniversalActive && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                            >
                              All Folders
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-mono bg-muted/80 px-1.5 py-0.5 rounded text-[10px] text-foreground">
                            {param.valueType}
                          </span>
                          {param.unit && <span className="text-primary font-medium">({param.unit})</span>}
                          {param.isRequired && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-300 border-amber-500/20"
                            >
                              Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(param)}
                      disabled={isPending || deletingId === param.id}
                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 transition-colors"
                      title={`Delete ${param.name}`}
                    >
                      {deletingId === param.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Parameter */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              {isUniversalActive
                ? 'Add Universal Parameter (Global)'
                : `Add Parameter to ${activeScopeName}`}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="param-name" className="text-xs text-foreground">
                  Parameter Name *
                </Label>
                <Input
                  id="param-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Warranty, Color, Grade, Voltage"
                  disabled={isPending}
                  className="h-9 text-sm bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Data Type *</Label>
                <Select value={valueType || undefined} onValueChange={setValueType} disabled={isPending}>
                  <SelectTrigger className="h-9 text-sm bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="DECIMAL">Decimal</SelectItem>
                    <SelectItem value="BOOLEAN">Boolean (Yes/No)</SelectItem>
                    <SelectItem value="DATE">Date</SelectItem>
                    <SelectItem value="SELECT">Select Dropdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="param-unit" className="text-xs text-foreground">
                  Unit (optional)
                </Label>
                <Input
                  id="param-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. Months, V, mm, Pins"
                  disabled={isPending}
                  className="h-9 text-sm bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs text-foreground font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary"
                  />
                  Required field
                </label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="w-full bg-primary hover:bg-primary text-foreground h-9 text-sm gap-2 mt-2 font-semibold shadow-lg shadow-primary/10"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isUniversalActive ? 'Add Universal Parameter' : 'Add Folder Parameter'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
