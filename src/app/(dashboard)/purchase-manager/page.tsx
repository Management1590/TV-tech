import React from 'react';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PurchaseManagerView } from '@/components/purchase-manager/purchase-manager-view';
import { AutoSuggestPanel } from '@/components/purchase-manager/auto-suggest-panel';

export const dynamic = 'force-dynamic';

export default async function PurchaseManagerPage() {
  const user = await getCurrentUser();
  if (user?.role === 'STAFF') {
    redirect('/inventory');
  }

  const [lists, oosItems, lowStockItems, catalogItems] = await Promise.all([
    prisma.purchaseList.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { fullName: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            item: {
              select: {
                id: true,
                name: true,
                quantity: true,
                isOutOfStock: true,
                location: true,
                supplierRecords: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  select: { shortCode: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { isOutOfStock: true },
      select: {
        id: true,
        name: true,
        quantity: true,
        isOutOfStock: true,
        location: true,
        supplierRecords: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { shortCode: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.item.findMany({
      where: {
        quantityMode: 'NUMERIC',
        quantity: { lte: 1 },
        isOutOfStock: false,
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        isOutOfStock: true,
        location: true,
        supplierRecords: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { shortCode: true },
        },
      },
      orderBy: { quantity: 'asc' },
    }),
    prisma.item.findMany({
      select: {
        id: true,
        name: true,
        quantity: true,
        isOutOfStock: true,
        location: true,
        supplierRecords: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { shortCode: true },
        },
        parameterValues: {
          take: 3,
          select: {
            valueText: true,
            valueNumber: true,
            parameterDefinition: { select: { name: true, unit: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Auto-Suggest AI Panel (Only items <= 1 qty or OOS) */}
      <AutoSuggestPanel
        purchaseLists={lists.map((l) => ({ id: l.id, title: l.title }))}
      />

      {/* Main Interactive Purchase Manager Workspace */}
      <PurchaseManagerView
        lists={lists}
        oosItems={oosItems}
        lowStockItems={lowStockItems}
        catalogItems={catalogItems}
      />
    </div>
  );
}
