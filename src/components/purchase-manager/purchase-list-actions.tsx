'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { updatePurchaseListStatusAction, deletePurchaseListAction } from '@/features/purchase-manager/actions/purchase.actions';
import type { PurchaseListStatus } from '@prisma/client';

const STATUS_CONFIG: Record<PurchaseListStatus, { label: string; color: string; next?: PurchaseListStatus }> = {
  DRAFT: { label: 'Draft', color: 'bg-muted/50 text-muted-foreground', next: 'READY_TO_PRINT' },
  READY_TO_PRINT: { label: 'Ready to Print', color: 'bg-primary/15 text-primary', next: 'ORDERED' },
  ORDERED: { label: 'Ordered', color: 'bg-amber-500/20 text-amber-600', next: 'PARTIALLY_RECEIVED' },
  PARTIALLY_RECEIVED: { label: 'Partial', color: 'bg-orange-500/20 text-orange-400', next: 'COMPLETED' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-600' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-50 text-red-600' },
};

interface PurchaseListActionsProps {
  listId: string;
  status: PurchaseListStatus;
}

export function PurchaseListActions({ listId, status }: PurchaseListActionsProps) {
  const [isPending, startTransition] = useTransition();

  const config = STATUS_CONFIG[status];
  const nextStatus = config.next;

  const handleAdvance = () => {
    if (!nextStatus) return;
    startTransition(async () => {
      const result = await updatePurchaseListStatusAction(listId, nextStatus);
      if (result.success) {
        toast.success(`Status updated to ${STATUS_CONFIG[nextStatus].label}`);
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await updatePurchaseListStatusAction(listId, 'CANCELLED');
      if (result.success) {
        toast.success('Purchase list cancelled');
      } else {
        toast.error(result.error || 'Failed to cancel');
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePurchaseListAction(listId);
      if (result.success) {
        toast.success('Purchase list deleted');
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className={config.color}>{config.label}</Badge>

      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

      {nextStatus && !isPending && (
        <Button size="sm" variant="outline" onClick={handleAdvance} className="text-xs h-7">
          → {STATUS_CONFIG[nextStatus].label}
        </Button>
      )}

      {status !== 'CANCELLED' && status !== 'COMPLETED' && !isPending && (
        <Button size="sm" variant="ghost" onClick={handleCancel} className="text-xs h-7 text-red-600 hover:text-red-300">
          Cancel
        </Button>
      )}

      {(status === 'DRAFT' || status === 'CANCELLED') && !isPending && (
        <Button size="sm" variant="ghost" onClick={handleDelete} className="text-xs h-7 text-red-600 hover:text-red-300">
          Delete
        </Button>
      )}
    </div>
  );
}
