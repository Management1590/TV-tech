import React from 'react';
import Link from 'next/link';
import { Package, AlertTriangle, FolderOpen, TrendingUp, Plus, ShoppingCart, Activity, ArrowUpRight, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { formatDistanceToNow } from 'date-fns';
import { DashboardAnalyticsCharts } from '@/components/dashboard/dashboard-analytics-charts';
import { getDailySnapshots } from '@/features/analytics/services/inventory-analytics.service';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (user?.role === 'STAFF') {
    redirect('/inventory');
  }

  const [
    totalItems,
    outOfStock,
    lowStock,
    totalFolders,
    topSelling,
    recentActivity,
    analyticsData,
    rawFolders,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.item.count({ where: { isOutOfStock: true } }),
    prisma.item.count({ where: { quantityMode: 'NUMERIC', quantity: { lte: 5 }, isOutOfStock: false } }),
    prisma.folder.count(),
    prisma.itemStockSettings.findMany({
      orderBy: { totalSold: 'desc' },
      take: 8,
      include: {
        item: {
          include: {
            folderItems: { include: { folder: { select: { name: true } } } },
            entity: { include: { mediaAttachments: { include: { media: true }, take: 1 } } },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true },
    }),
    getDailySnapshots('all'),
    prisma.folder.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { folderItems: true } },
      },
    }),
  ]);

  const formattedFolders = rawFolders.map((f) => ({
    id: f.id,
    name: f.name,
    _count: { folderItems: f._count.folderItems },
  }));

  return (
    <div className="space-y-5 sm:space-y-8 p-1 sm:p-4 md:p-8">
      {/* Premium Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              TV Tech OS v2.0
            </span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">•</span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">Workshop & Inventory Console</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            MODERN ELECTRONICS
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
            Centralized inventory tracking, supplier cost records & intelligent catalog management
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="px-3 py-1.5 bg-slate-100/90 border border-border/80 rounded-2xl flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-foreground">System Online</span>
          </div>
        </div>
      </div>

      {/* Interactive 4-Box KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Box 1: Total Items -> /inventory?view=all */}
        <Link href="/inventory?view=all" className="group block focus:outline-none">
          <Card className="h-full bg-white hover:bg-blue-50/40 border border-border/80 hover:border-blue-300/80 shadow-blend hover:shadow-xl hover:-translate-y-1 transition-all duration-200 rounded-3xl p-3.5 sm:p-5 cursor-pointer relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-blue-700 transition-colors">
                Total Items
              </span>
              <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-500/20 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xs">
                <Package className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-extrabold text-foreground font-mono group-hover:text-blue-700 transition-colors">
                {totalItems.toLocaleString('en-IN')}
              </div>
              <ArrowUpRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>

            <div className="mt-2 text-[11px] font-semibold text-muted-foreground group-hover:text-blue-600 flex items-center gap-1 transition-colors">
              <span>View full flat catalog</span>
              <span>→</span>
            </div>
          </Card>
        </Link>

        {/* Box 2: Out of Stock -> /inventory?stock=out */}
        <Link href="/inventory?stock=out" className="group block focus:outline-none">
          <Card className="h-full bg-white hover:bg-red-50/40 border border-border/80 hover:border-red-300/80 shadow-blend hover:shadow-xl hover:-translate-y-1 transition-all duration-200 rounded-3xl p-3.5 sm:p-5 cursor-pointer relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-red-700 transition-colors">
                Out of Stock
              </span>
              <div className="w-9 h-9 rounded-2xl bg-red-50 border border-red-500/20 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all shadow-2xs">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-extrabold text-red-600 font-mono">
                {outOfStock.toLocaleString('en-IN')}
              </div>
              <ArrowUpRight className="w-4 h-4 text-red-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>

            <div className="mt-2 text-[11px] font-semibold text-muted-foreground group-hover:text-red-600 flex items-center gap-1 transition-colors">
              <span>View out-of-stock items</span>
              <span>→</span>
            </div>
          </Card>
        </Link>

        {/* Box 3: Low Stock -> /inventory?stock=low */}
        <Link href="/inventory?stock=low" className="group block focus:outline-none">
          <Card className="h-full bg-white hover:bg-amber-50/40 border border-border/80 hover:border-amber-300/80 shadow-blend hover:shadow-xl hover:-translate-y-1 transition-all duration-200 rounded-3xl p-3.5 sm:p-5 cursor-pointer relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-amber-700 transition-colors">
                Low Stock Alert
              </span>
              <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-500/20 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-2xs">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-600 font-mono">
                {lowStock.toLocaleString('en-IN')}
              </div>
              <ArrowUpRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>

            <div className="mt-2 text-[11px] font-semibold text-muted-foreground group-hover:text-amber-700 flex items-center gap-1 transition-colors">
              <span>Restock priority items</span>
              <span>→</span>
            </div>
          </Card>
        </Link>

        {/* Box 4: Total Folders -> /inventory */}
        <Link href="/inventory" className="group block focus:outline-none">
          <Card className="h-full bg-white hover:bg-violet-50/40 border border-border/80 hover:border-violet-300/80 shadow-blend hover:shadow-xl hover:-translate-y-1 transition-all duration-200 rounded-3xl p-3.5 sm:p-5 cursor-pointer relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-violet-700 transition-colors">
                Total Folders
              </span>
              <div className="w-9 h-9 rounded-2xl bg-violet-50 border border-violet-500/20 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all shadow-2xs">
                <FolderOpen className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-extrabold text-violet-700 font-mono">
                {totalFolders.toLocaleString('en-IN')}
              </div>
              <ArrowUpRight className="w-4 h-4 text-violet-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>

            <div className="mt-2 text-[11px] font-semibold text-muted-foreground group-hover:text-violet-700 flex items-center gap-1 transition-colors">
              <span>Open folder hierarchy</span>
              <span>→</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Premium Navigation Action Bar */}
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Knowledge Base */}
        <Link href="/knowledge-base" className="group">
          <Button
            variant="outline"
            className="h-11 px-5 rounded-2xl bg-white hover:bg-slate-50/90 text-foreground border border-border/80 shadow-2xs hover:shadow-md hover:border-violet-300 hover:text-violet-700 transition-all duration-200 cursor-pointer font-semibold text-xs sm:text-sm"
          >
            <BookOpen className="mr-2.5 h-4 w-4 text-violet-500 group-hover:scale-110 transition-transform" />
            Knowledge Base
          </Button>
        </Link>

        {/* Inventory & Items */}
        <Link href="/inventory" className="group">
          <Button
            variant="outline"
            className="h-11 px-5 rounded-2xl bg-white hover:bg-slate-50/90 text-foreground border border-border/80 shadow-2xs hover:shadow-md hover:border-blue-300 hover:text-blue-700 transition-all duration-200 cursor-pointer font-semibold text-xs sm:text-sm"
          >
            <Package className="mr-2.5 h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
            Inventory & Items
          </Button>
        </Link>

        {/* Purchase Manager */}
        <Link href="/purchase-manager" className="group">
          <Button
            variant="outline"
            className="h-11 px-5 rounded-2xl bg-white hover:bg-slate-50/90 text-foreground border border-border/80 shadow-2xs hover:shadow-md hover:border-emerald-300 hover:text-emerald-700 transition-all duration-200 cursor-pointer font-semibold text-xs sm:text-sm"
          >
            <ShoppingCart className="mr-2.5 h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            Purchase Manager
          </Button>
        </Link>
      </div>

      {/* Interactive Analytics & Profit Line Graphs */}
      <DashboardAnalyticsCharts
        snapshots={analyticsData.snapshots}
        currentValuation={analyticsData.currentValuation}
        folders={formattedFolders}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Most Selling Items section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground tracking-tight">Most Selling Items</h3>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
            {topSelling.map((ts: any) => (
              <Card key={ts.id} className="min-w-[280px] shrink-0 bg-white border border-border/80 shadow-blend snap-start hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="p-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base text-foreground font-medium line-clamp-1" title={ts.item.name}>{ts.item.name}</CardTitle>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 whitespace-nowrap ml-2">
                      {ts.totalSold} sold
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                    {ts.item.folderItems.map((fi: any) => fi.folder.name).join(', ') || 'Uncategorized'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                   <div className="text-sm text-muted-foreground">
                      Stock: {ts.item.isOutOfStock ? <span className="text-red-600 font-medium">Out of Stock</span> : ts.item.quantityMode === 'NUMERIC' ? <span className="font-medium text-foreground">{ts.item.quantity}</span> : <span className="text-emerald-600 font-medium">In Stock</span>}
                   </div>
                </CardContent>
              </Card>
            ))}
            {topSelling.length === 0 && (
              <div className="text-muted-foreground text-sm">No sales data available.</div>
            )}
          </div>
        </div>

        {/* Recent Activity section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-500" />
            <h3 className="text-lg font-semibold text-foreground tracking-tight">Recent Activity</h3>
          </div>
          <Card className="bg-card border border-border shadow-blend p-0 overflow-hidden">
            <div className="divide-y divide-border">
              {recentActivity.map((log: any) => (
                <div key={log.id} className="p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{log.action}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)) : `Entity: ${log.entityType}`}
                  </div>
                  <div className="text-xs text-muted-foreground/70 mt-1">
                    by {log.user?.fullName || log.user?.email || 'System'}
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No recent activity.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
