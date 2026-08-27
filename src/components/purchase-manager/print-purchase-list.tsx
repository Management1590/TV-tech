'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintPurchaseListProps {
  listId: string;
}

export function PrintPurchaseList({ listId }: PrintPurchaseListProps) {
  const handlePrint = () => {
    window.open(`/api/purchase-manager/${listId}/print`, '_blank');
  };

  return (
    <Button size="sm" variant="outline" className="text-xs h-8" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-1" />
      Print / PDF
    </Button>
  );
}
