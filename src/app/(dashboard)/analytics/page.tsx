import React from 'react';
import { TrendingUp, Package, AlertTriangle, IndianRupee, BarChart2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/config/currency';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (user?.role === 'STAFF') {
    redirect('/inventory');
  }

  const [
    totalItems,
    outOfStockCount,
    lowStockCount,
    topSellingItems,
    recentMovements,
    supplierRecords,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.item.count({ where: { isOutOfStock: true } }),
    prisma.item.count({ where: { quantityMode: 'NUMERIC', quantity: { lte: 5 }, isOutOfStock: false } }),
    prisma.itemStockSettings.findMany({
      orderBy: { totalSold: 'desc' },
      take: 5,
      include: {
        item: {
          select: { id: true, name: true, location: true },
        },
      },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        item: { select: { name: true } },
        performedBy: { select: { fullName: true } },
      },
    }),
    prisma.supplierRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { costPrice: true, sellingPrice: true },
    }),
  ]);

  // Aggregate financial metrics
  const totalCost = supplierRecords.reduce((acc, r) => acc + (r.costPrice ? Number(r.costPrice) : 0), 0);
  const totalSelling = supplierRecords.reduce((acc, r) => acc + (r.sellingPrice ? Number(r.sellingPrice) : 0), 0);
  const avgProfitMargin = supplierRecords.length > 0 && totalCost > 0
    ? (((totalSelling - totalCost) / totalCost) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Smart Sorting & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time insights on stock performance, margins, and sales velocity
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-card border border-border shadow-blend">
          <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-xs uppercase font-medium text-muted-foreground truncate">Total Catalog Items</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">{totalItems}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border shadow-blend">
          <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-xs uppercase font-medium text-muted-foreground truncate">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-red-600">{outOfStockCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border shadow-blend">
          <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-xs uppercase font-medium text-muted-foreground truncate">Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{lowStockCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border shadow-blend">
          <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-xs uppercase font-medium text-muted-foreground truncate">Est. Margin</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{avgProfitMargin}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Selling Items */}
        <Card className="bg-card border border-border shadow-blend">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Top Selling Items
            </CardTitle>
            <CardDescription className="text-xs">Ranked by sales velocity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSellingItems.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No sales records yet</p>
            ) : (
              topSellingItems.map((ts) => (
                <div key={ts.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{ts.item.name}</p>
                    <p className="text-xs text-muted-foreground">{ts.item.location ?? 'Unspecified'}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {ts.totalSold} sold
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Stock Activity */}
        <Card className="bg-card border border-border shadow-blend">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" /> Recent Stock Movements
            </CardTitle>
            <CardDescription className="text-xs">Audit of latest inventory adjustments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMovements.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No stock movements recorded yet</p>
            ) : (
              recentMovements.map((mv) => (
                <div key={mv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{mv.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {mv.performedBy?.fullName ?? 'System'} • {mv.movementType}
                    </p>
                  </div>
                  <Badge
                    variant={mv.quantityChange > 0 ? 'secondary' : 'destructive'}
                    className="shrink-0 font-mono"
                  >
                    {mv.quantityChange > 0 ? `+${mv.quantityChange}` : mv.quantityChange}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
