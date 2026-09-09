'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Package,
  AlertTriangle,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Printer,
  Minus,
  Check,
  Search,
  FileText,
  Layers,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  createPurchaseListAction,
  addDirectPurchaseItemAction,
  removeItemFromPurchaseListAction,
  updatePurchaseListItemAction,
  deletePurchaseListAction,
  addItemToPurchaseListAction,
} from '@/features/purchase-manager/actions/purchase.actions';

export type TabType = 'ACTIVE_LISTS' | 'OUT_OF_STOCK' | 'LOW_STOCK';

interface PurchaseManagerViewProps {
  lists: any[];
  oosItems: any[];
  lowStockItems: any[];
  catalogItems: any[];
}

export function PurchaseManagerView({
  lists,
  oosItems,
  lowStockItems,
  catalogItems,
}: PurchaseManagerViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE_LISTS');
  const [isPending, startTransition] = useTransition();

  // Create List Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Selected List for quick adding from OOS / Low Stock tabs
  const [selectedListForQuickAdd, setSelectedListForQuickAdd] = useState<string>(
    lists[0]?.id || ''
  );

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    startTransition(async () => {
      const res = await createPurchaseListAction({
        title: newTitle.trim(),
        notes: newNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Purchase List "${newTitle}" created!`);
        setIsCreateOpen(false);
        setNewTitle('');
        setNewNotes('');
        setActiveTab('ACTIVE_LISTS');
      } else {
        toast.error(res.error || 'Failed to create list.');
      }
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-primary" />
            Purchase Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Create required spare parts lists, add items directly, and generate supplier-ready PDFs.
          </p>
        </div>

        {/* Create List Trigger */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger>
            <Button className="h-10 px-4 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm-md shadow-sm-primary/20 gap-2 cursor-pointer">
              <Plus className="h-4 w-4" /> New Purchase List
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px] bg-background border-border">
            <form onSubmit={handleCreateList}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  Create New Purchase List
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-title" className="text-xs font-bold">
                    List Title *
                  </Label>
                  <Input
                    id="pl-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Weekly Restock — TV Backlights & Mainboards"
                    autoFocus
                    disabled={isPending}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pl-notes" className="text-xs font-bold">
                    Supplier / Purpose Notes (Optional)
                  </Label>
                  <Input
                    id="pl-notes"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Vendor: Sun Electronics, Urgent repair parts..."
                    disabled={isPending}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !newTitle.trim()}
                  className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create List
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ========================================================================= */}
      {/* 3 INTERACTIVE CLICKABLE SUMMARY TABS                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tab 1: Out of Stock Items */}
        <button
          type="button"
          onClick={() => setActiveTab('OUT_OF_STOCK')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
            activeTab === 'OUT_OF_STOCK'
              ? 'bg-red-50/90 border-red-500 shadow-sm-md ring-2 ring-red-500/20'
              : 'bg-card hover:bg-red-50/40 border-border/80 shadow-sm-2xs'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-red-600">{oosItems.length}</p>
            <p className="text-xs font-bold text-foreground/80">Out of Stock Items</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click to view items needing restock</p>
          </div>
        </button>

        {/* Tab 2: Low Stock Items (<= 1 quantity) */}
        <button
          type="button"
          onClick={() => setActiveTab('LOW_STOCK')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
            activeTab === 'LOW_STOCK'
              ? 'bg-amber-50/90 border-amber-500 shadow-sm-md ring-2 ring-amber-500/20'
              : 'bg-card hover:bg-amber-50/40 border-border/80 shadow-sm-2xs'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-600">{lowStockItems.length}</p>
            <p className="text-xs font-bold text-foreground/80">Low Stock Items (≤ 1 Unit)</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click to view low inventory parts</p>
          </div>
        </button>

        {/* Tab 3: Active Purchase Lists */}
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE_LISTS')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
            activeTab === 'ACTIVE_LISTS'
              ? 'bg-primary/5 border-primary shadow-sm-md ring-2 ring-primary/20'
              : 'bg-card hover:bg-primary/5 border-border/80 shadow-sm-2xs'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-primary/8 text-primary flex items-center justify-center shrink-0">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-primary">{lists.length}</p>
            <p className="text-xs font-bold text-foreground/80">Active Purchase Lists</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click to view and print orders</p>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT 1: OUT OF STOCK ITEMS                                        */}
      {/* ========================================================================= */}
      {activeTab === 'OUT_OF_STOCK' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-black text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Out of Stock Inventory ({oosItems.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                These items are currently 0 quantity or marked out of stock. Add them to a purchase list with 1 click.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('ACTIVE_LISTS')}
              className="text-xs rounded-xl self-start sm:self-auto shrink-0"
            >
              ← Back to Purchase Lists
            </Button>
          </div>

          {oosItems.length === 0 ? (
            <Card className="p-8 text-center bg-emerald-50/40 border-emerald-200/80">
              <p className="text-sm font-bold text-emerald-800">
                🎉 No out of stock items! All products are currently active.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {oosItems.map((item) => (
                <QuickAddCard
                  key={item.id}
                  item={item}
                  lists={lists}
                  isOos={true}
                  onAddSuccess={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 2: LOW STOCK ITEMS (<= 1 Unit)                               */}
      {/* ========================================================================= */}
      {activeTab === 'LOW_STOCK' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-black text-amber-600 flex items-center gap-2">
                <Package className="w-4 h-4 shrink-0" />
                Low Stock Inventory (≤ 1 Unit Remaining) ({lowStockItems.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Items with 1 or fewer units remaining in inventory.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('ACTIVE_LISTS')}
              className="text-xs rounded-xl self-start sm:self-auto shrink-0"
            >
              ← Back to Purchase Lists
            </Button>
          </div>

          {lowStockItems.length === 0 ? (
            <Card className="p-8 text-center bg-emerald-50/40 border-emerald-200/80">
              <p className="text-sm font-bold text-emerald-800">
                🎉 No low stock items! Stock levels are healthy.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lowStockItems.map((item) => (
                <QuickAddCard
                  key={item.id}
                  item={item}
                  lists={lists}
                  isOos={false}
                  onAddSuccess={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 3: ACTIVE PURCHASE LISTS (Main Rebuilt Workspace)             */}
      {/* ========================================================================= */}
      {activeTab === 'ACTIVE_LISTS' && (
        <div className="space-y-6">
          {lists.length === 0 ? (
            <Card className="border-dashed border-2 border-border p-12 text-center rounded-3xl">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-foreground">No Purchase Lists Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-5">
                Create your first purchase list to specify items, descriptions, and quantities, then generate a PDF for suppliers.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="font-bold text-xs rounded-xl bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Create Purchase List
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {lists.map((list) => (
                <PurchaseListCard
                  key={list.id}
                  list={list}
                  catalogItems={catalogItems}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SINGLE PURCHASE LIST CARD COMPONENT (Direct Item Entry & PDF Generation)
// ============================================================================
interface PurchaseListCardProps {
  list: any;
  catalogItems: any[];
}

function PurchaseListCard({ list, catalogItems }: PurchaseListCardProps) {
  const [isPending, startTransition] = useTransition();

  // Inline Direct Item Entry State
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  // Autocomplete Suggestions
  const [filteredCatalog, setFilteredCatalog] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleNameChange = (val: string) => {
    setItemName(val);
    setSelectedCatalogId(null);
    if (val.trim().length > 1) {
      const matches = catalogItems.filter((it) =>
        it.name.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredCatalog(matches.slice(0, 5));
      setShowDropdown(matches.length > 0);
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelectCatalogItem = (it: any) => {
    setItemName(it.name);
    setSelectedCatalogId(it.id);
    if (it.parameterValues && it.parameterValues.length > 0) {
      const specs = it.parameterValues
        .map(
          (pv: any) =>
            `${pv.parameterDefinition.name}: ${pv.valueText || pv.valueNumber || ''}`
        )
        .join(', ');
      setDescription(specs);
    } else {
      setDescription('');
    }
    setShowDropdown(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error('Please enter an item name.');
      return;
    }

    startTransition(async () => {
      const res = await addDirectPurchaseItemAction({
        purchaseListId: list.id,
        itemName: itemName.trim(),
        description: description.trim() || undefined,
        quantity: Math.max(1, quantity),
        itemId: selectedCatalogId || undefined,
      });

      if (res.success) {
        toast.success(`Added "${itemName}" (Qty: ${quantity})`);
        setItemName('');
        setDescription('');
        setQuantity(1);
        setSelectedCatalogId(null);
        setShowDropdown(false);
      } else {
        toast.error(res.error || 'Failed to add item.');
      }
    });
  };

  const handleDeleteItem = (itemId: string, name: string) => {
    startTransition(async () => {
      const res = await removeItemFromPurchaseListAction(itemId);
      if (res.success) {
        toast.success(`Removed "${name}"`);
      } else {
        toast.error(res.error || 'Failed to remove item.');
      }
    });
  };

  const handleDeleteList = () => {
    if (!confirm(`Are you sure you want to delete "${list.title}"?`)) return;

    startTransition(async () => {
      const res = await deletePurchaseListAction(list.id);
      if (res.success) {
        toast.success(`Purchase List "${list.title}" deleted.`);
      } else {
        toast.error(res.error || 'Failed to delete list.');
      }
    });
  };

  const handlePrintPdf = () => {
    window.open(`/api/purchase-manager/${list.id}/print`, '_blank');
  };

  const rawTitle = list.title || 'Purchase List';
  const cleanListTitle = rawTitle.replace(/_\d{10,}$/, '');

  return (
    <Card className="rounded-3xl border border-border/80 shadow-sm-md bg-card overflow-hidden">
      {/* Header Bar */}
      <CardHeader className="bg-muted/80 border-b border-border/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-foreground truncate">
                {cleanListTitle}
              </h2>
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20 text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
              >
                {list.items?.length || 0} Items
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                Created {formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })}
              </span>
              {list.notes && (
                <span className="text-foreground/80 font-medium truncate max-w-[300px]">
                  • {list.notes}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons: Print PDF & Prominent Delete Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-white hover:bg-muted/50 border-border text-foreground shadow-sm-2xs gap-1.5 cursor-pointer flex-1 sm:flex-initial justify-center"
            >
              <Printer className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Print PDF</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeleteList}
              disabled={isPending}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-red-50/80 hover:bg-red-100 border-red-200 text-red-600 hover:text-red-700 shadow-sm-2xs gap-1.5 cursor-pointer shrink-0"
              title="Delete Purchase List"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-5 space-y-4 sm:space-y-5">
        {/* ========================================================================= */}
        {/* DIRECT ITEM ENTRY ROW (Item Name, Description, Quantity)                 */}
        {/* ========================================================================= */}
        <div className="p-3 sm:p-4 rounded-2xl bg-muted/90 border border-border/80 space-y-3">
          <span className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-primary" />
            Add Required Item / Spare Part:
          </span>

          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* 1. Item Name Input with Catalog Autocomplete */}
            <div className="md:col-span-5 relative space-y-1">
              <Label className="text-[11px] font-bold text-foreground">
                Item Name *
              </Label>
              <Input
                placeholder="e.g. Backlight Strip 32 inch, Power Board 55 inch..."
                value={itemName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs rounded-xl bg-white border-border"
              />

              {/* Autocomplete Dropdown with 4-Digit Code */}
              {showDropdown && filteredCatalog.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-border rounded-xl shadow-sm-lg overflow-hidden max-h-48 overflow-y-auto">
                  {filteredCatalog.map((catItem) => {
                    const code = catItem.supplierRecords?.[0]?.shortCode;
                    return (
                      <button
                        key={catItem.id}
                        type="button"
                        onClick={() => handleSelectCatalogItem(catItem)}
                        className="w-full p-2 text-left hover:bg-muted/50 border-b border-border/50 text-xs flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {code && (
                            <span className="font-mono text-primary font-black bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                              #{code}
                            </span>
                          )}
                          <span className="font-bold text-foreground truncate">{catItem.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                          {catItem.isOutOfStock ? 'OOS' : `${catItem.quantity ?? '∞'} In Stock`}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Item Description / Specs Input */}
            <div className="md:col-span-4 space-y-1">
              <Label className="text-[11px] font-bold text-foreground">
                Description / Specifications
              </Label>
              <Input
                placeholder="e.g. 8 LEDs, 3V, 580mm, Aluminium substrate..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs rounded-xl bg-white border-border"
              />
            </div>

            {/* 3. Quantity Stepper Input */}
            <div className="md:col-span-2 space-y-1">
              <Label className="text-[11px] font-bold text-foreground">
                Quantity
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-9 w-9 p-0 rounded-lg bg-white shrink-0 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 text-center font-mono font-bold text-xs rounded-lg bg-white text-foreground"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(quantity + 1)}
                  className="h-9 w-9 p-0 rounded-lg bg-white shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* 4. Add Button */}
            <div className="md:col-span-1">
              <Button
                type="submit"
                disabled={isPending || !itemName.trim()}
                className="w-full h-9 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* LIST OF REQUIRED ITEMS (Desktop Table + Mobile All-In-One Cards)          */}
        {/* ========================================================================= */}
        {list.items && list.items.length > 0 ? (
          <div>
            {/* ── 1. MOBILE ALL-IN-ONE LUXURY ITEM CARDS (md:hidden) ── */}
            <div className="md:hidden space-y-2.5">
              {list.items.map((it: any, idx: number) => {
                const code = it.item?.supplierRecords?.[0]?.shortCode;
                const rawName = it.itemName || it.item?.name || 'Unnamed Item';
                const cleanItemName = rawName.replace(/_\d{10,}$/, '');

                return (
                  <div
                    key={it.id}
                    className="p-3.5 rounded-2xl bg-white border border-border/80 shadow-sm-xs space-y-2.5 transition-all hover:border-primary/40"
                  >
                    {/* Header Row: Index + Code + Item Name + Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-[11px] font-extrabold text-muted-foreground/70 shrink-0">
                          #{idx + 1}
                        </span>
                        {code && (
                          <span className="font-mono text-primary font-black bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                            #{code}
                          </span>
                        )}
                        <h4 className="font-black text-xs text-foreground truncate leading-tight">
                          {cleanItemName}
                        </h4>
                      </div>

                      {/* Delete Action Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(it.id, cleanItemName)}
                        className="h-7 w-7 p-0 text-red-500 hover:bg-red-50/80 hover:text-red-700 rounded-lg cursor-pointer shrink-0 -mt-1 -mr-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Middle Section: Specifications & Notes (if any) */}
                    {(it.description || it.notes) && (
                      <div className="p-2 rounded-xl bg-muted/90 border border-border/60 text-muted-foreground text-[11px] font-medium leading-relaxed">
                        {it.description || it.notes}
                      </div>
                    )}

                    {/* Footer Row: Quantity Pill */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Required Quantity:
                      </span>
                      <span className="bg-primary/10 text-primary border border-primary/25 font-mono font-black text-xs px-2.5 py-0.5 rounded-lg shadow-sm-2xs">
                        {it.quantity} {it.quantity === 1 ? 'Unit' : 'Units'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── 2. DESKTOP FULL DATA TABLE (hidden md:block) ── */}
            <div className="hidden md:block rounded-2xl border border-border/80 overflow-hidden shadow-sm-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/80 text-foreground font-extrabold uppercase text-[10px] tracking-wider border-b border-border/80">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Required Item / Spare Part</th>
                      <th className="p-3">Specifications / Description</th>
                      <th className="p-3 w-28 text-center">Quantity</th>
                      <th className="p-3 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-white">
                    {list.items.map((it: any, idx: number) => {
                      const code = it.item?.supplierRecords?.[0]?.shortCode;
                      const rawName = it.itemName || it.item?.name || 'Unnamed Item';
                      const cleanItemName = rawName.replace(/_\d{10,}$/, '');

                      return (
                        <tr key={it.id} className="hover:bg-muted/80 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-bold text-foreground">
                            <div className="flex items-center gap-2">
                              {code && (
                                <span className="font-mono text-primary font-black bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                                  #{code}
                                </span>
                              )}
                              <span className="truncate">{cleanItemName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {it.description || it.notes || '—'}
                          </td>
                          <td className="p-3 text-center font-mono font-black text-foreground">
                            <span className="bg-muted px-2.5 py-1 rounded-md">
                              {it.quantity} Units
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(it.id, cleanItemName)}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50/80 hover:text-red-700 rounded-lg cursor-pointer inline-flex items-center justify-center"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center rounded-2xl bg-muted/50 border border-dashed border-border/80">
            <p className="text-xs text-muted-foreground font-medium">
              No items added to this list yet. Enter an item name above or add from AI Suggestions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QUICK ADD CARD (For Out of Stock & Low Stock Items)
// ============================================================================
function QuickAddCard({
  item,
  lists,
  isOos,
  onAddSuccess,
}: {
  item: any;
  lists: any[];
  isOos: boolean;
  onAddSuccess: () => void;
}) {
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(5);
  const [isPending, startTransition] = useTransition();

  const code = item.supplierRecords?.[0]?.shortCode;
  const cleanItemName = (item.name || '').replace(/_\d{10,}$/, '');
  const selectedList = lists.find((l) => l.id === selectedListId) || lists[0];

  const handleAdd = () => {
    if (!selectedListId) {
      toast.error('Please select a purchase list first.');
      return;
    }

    startTransition(async () => {
      const res = await addItemToPurchaseListAction({
        purchaseListId: selectedListId,
        itemId: item.id,
        itemName: cleanItemName,
        description: undefined, // Keep description clean, no location!
        quantity,
      });

      if (res.success) {
        toast.success(`Added "${cleanItemName}" (Qty: ${quantity}) to ${selectedList?.title || 'list'}!`);
        onAddSuccess();
      } else {
        toast.error(res.error || 'Failed to add item.');
      }
    });
  };

  return (
    <Card className="p-3.5 sm:p-4 rounded-2xl border border-border/80 shadow-sm-xs hover:border-primary/40 transition-all bg-card flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {code && (
              <span className="font-mono text-primary font-black bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                #{code}
              </span>
            )}
            <h4 className="text-xs font-black text-foreground truncate">{cleanItemName}</h4>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                isOos
                  ? 'bg-red-50/80 text-red-700 border-red-300'
                  : 'bg-amber-50/80 text-amber-700 border-amber-300'
              }`}
            >
              {isOos ? '0 In Stock (Out of Stock)' : `${item.quantity ?? 1} Unit In Stock`}
            </Badge>
            {item.location && (
              <span className="text-[10px] text-muted-foreground font-mono">
                📍 {item.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-border/60">
        <Select
          value={selectedListId}
          onValueChange={(val: string | null) => {
            if (val) setSelectedListId(val);
          }}
        >
          <SelectTrigger className="h-9 sm:h-8 text-xs bg-white border-border rounded-xl flex-1 cursor-pointer font-medium">
            <SelectValue placeholder="Select List...">
              {selectedList ? selectedList.title : 'Select List...'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-white border-border text-xs z-50">
            {lists.map((l) => (
              <SelectItem key={l.id} value={l.id} className="cursor-pointer font-medium text-xs">
                {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:gap-1 shrink-0">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-9 sm:h-8 w-16 sm:w-14 text-center font-mono font-bold text-xs rounded-xl bg-white"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={isPending || !selectedListId}
            className="h-9 sm:h-8 px-4 sm:px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1 cursor-pointer flex-1 sm:flex-initial justify-center shadow-sm-xs"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
}

