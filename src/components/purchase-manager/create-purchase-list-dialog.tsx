'use client';

import { useState, useTransition } from 'react';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createPurchaseListAction } from '@/features/purchase-manager/actions/purchase.actions';

export function CreatePurchaseListDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createPurchaseListAction({
        title: title.trim(),
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success(`Purchase list "${title}" created`);
        setOpen(false);
        setTitle('');
        setNotes('');
      } else {
        toast.error(result.error || 'Failed to create purchase list');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" className="gap-2">
          <ShoppingBag className="h-4 w-4" /> New Purchase List
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Purchase List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pl-title">Title *</Label>
              <Input
                id="pl-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly Restock — Aug 2026"
                autoFocus
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-notes">Notes</Label>
              <Textarea
                id="pl-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Supplier, budget, or priority notes..."
                rows={3}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create List
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
