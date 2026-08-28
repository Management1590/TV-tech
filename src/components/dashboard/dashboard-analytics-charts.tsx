'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Package,
  IndianRupee,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  DollarSign,
  Info,
  ShieldCheck,
  Coins,
  Receipt,
  Boxes,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatMoney } from '@/lib/config/currency';
import { FormattedDailySnapshot, AnalyticsTimePeriod } from '@/features/analytics/services/inventory-analytics.service';

export interface RawFolderData {
  id: string;
  name: string;
  _count: { folderItems: number };
}

interface DashboardAnalyticsChartsProps {
  snapshots: FormattedDailySnapshot[];
  currentValuation: {
    totalInventoryCost: number;
    totalInventoryRetail: number;
    totalCatalogItems: number;
    totalInStockUnits: number;
  };
  folders: RawFolderData[];
}

export function DashboardAnalyticsCharts({
  snapshots,
  currentValuation,
  folders,
}: DashboardAnalyticsChartsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [period, setPeriod] = useState<AnalyticsTimePeriod>('this_month');
  const [activeTab, setActiveTab] = useState<'profit' | 'inventory' | 'categories'>('profit');

  // Metric display toggles for Graph 1
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const [showInventoryCost, setShowInventoryCost] = useState(true);

  // Metric display toggles for Graph 2
  const [showInflow, setShowInflow] = useState(true);
  const [showOutflow, setShowOutflow] = useState(true);
  const [showTotalUnits, setShowTotalUnits] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter real snapshots according to the selected time period
  const realPeriodSnapshots = useMemo(() => {
    const now = new Date();
    const todayStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().split('T')[0];

    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = new Date(Date.UTC(yest.getFullYear(), yest.getMonth(), yest.getDate())).toISOString().split('T')[0];

    const startOfMonthStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
    const cutoff3m = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 90)).toISOString().split('T')[0];
    const cutoff6m = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 180)).toISOString().split('T')[0];
    const cutoffYear = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 365)).toISOString().split('T')[0];

    if (period === 'today') {
      return snapshots.filter((s) => s.date === todayStr);
    }
    if (period === 'yesterday') {
      return snapshots.filter((s) => s.date === yesterdayStr);
    }
    if (period === 'this_month') {
      return snapshots.filter((s) => s.date >= startOfMonthStr && s.date <= todayStr);
    }
    if (period === '3m') {
      return snapshots.filter((s) => s.date >= cutoff3m);
    }
    if (period === '6m') {
      return snapshots.filter((s) => s.date >= cutoff6m);
    }
    if (period === 'year') {
      return snapshots.filter((s) => s.date >= cutoffYear);
    }
    return snapshots; // 'all'
  }, [snapshots, period]);

  // Timeseries formatted for Recharts (guarantees at least 2 points for continuous line curves)
  const chartTimeseries = useMemo(() => {
    if (realPeriodSnapshots.length === 0) {
      const label = period === 'today' ? 'Today' : period === 'yesterday' ? 'Yesterday' : 'Period';
      return [
        {
          id: 'placeholder_start',
          date: 'start',
          displayDate: 'Start',
          totalInventoryCost: currentValuation.totalInventoryCost,
          totalInventoryRetail: currentValuation.totalInventoryRetail,
          totalRevenue: 0,
          totalProfit: 0,
          totalCogs: 0,
          unitsSold: 0,
          unitsPurchased: 0,
          totalInStockUnits: currentValuation.totalInStockUnits,
          totalCatalogItems: currentValuation.totalCatalogItems,
        },
        {
          id: 'placeholder_end',
          date: 'end',
          displayDate: label,
          totalInventoryCost: currentValuation.totalInventoryCost,
          totalInventoryRetail: currentValuation.totalInventoryRetail,
          totalRevenue: 0,
          totalProfit: 0,
          totalCogs: 0,
          unitsSold: 0,
          unitsPurchased: 0,
          totalInStockUnits: currentValuation.totalInStockUnits,
          totalCatalogItems: currentValuation.totalCatalogItems,
        },
      ];
    } else if (realPeriodSnapshots.length === 1) {
      const prevDate = new Date(new Date(realPeriodSnapshots[0].date).getTime() - 24 * 3600 * 1000);
      const isSingleDayView = period === 'today' || period === 'yesterday';
      return [
        {
          id: 'placeholder_prev',
          date: isSingleDayView ? 'start' : prevDate.toISOString().split('T')[0],
          displayDate: isSingleDayView ? '00:00' : prevDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          totalInventoryCost: realPeriodSnapshots[0].totalInventoryCost,
          totalInventoryRetail: realPeriodSnapshots[0].totalInventoryRetail,
          totalRevenue: 0,
          totalProfit: 0,
          totalCogs: 0,
          unitsSold: 0,
          unitsPurchased: 0,
          totalInStockUnits: realPeriodSnapshots[0].totalInStockUnits,
          totalCatalogItems: realPeriodSnapshots[0].totalCatalogItems,
        },
        realPeriodSnapshots[0],
      ];
    }
    return realPeriodSnapshots;
  }, [realPeriodSnapshots, period, currentValuation]);

  // Calculate live aggregate totals strictly from real database snapshots
  const periodStats = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCogs = 0;
    let unitsSold = 0;
    let unitsPurchased = 0;

    realPeriodSnapshots.forEach((s) => {
      totalRevenue += s.totalRevenue;
      totalProfit += s.totalProfit;
      totalCogs += s.totalCogs;
      unitsSold += s.unitsSold;
      unitsPurchased += s.unitsPurchased;
    });

    const marginPercent =
      totalCogs > 0
        ? ((totalProfit / totalCogs) * 100).toFixed(1)
        : totalRevenue > 0
        ? '100'
        : '0';

    return {
      totalRevenue,
      totalProfit,
      totalCogs,
      unitsSold,
      unitsPurchased,
      marginPercent,
    };
  }, [realPeriodSnapshots]);

  // Category Breakdown Data
  const categoryData = useMemo(() => {
    return folders
      .map((f) => ({
        name: f.name,
        count: f._count.folderItems,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [folders]);

  if (!isMounted) {
    return (
      <div className="h-80 w-full rounded-3xl bg-muted/80 animate-pulse border border-border/80 flex items-center justify-center">
        <span className="text-xs text-muted-foreground font-medium">Loading Interactive Financial Engine...</span>
      </div>
    );
  }

  return (
    <Card className="bg-white border border-border/80 shadow-blend rounded-3xl overflow-hidden p-3.5 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Financial Analytics & Inventory Valuation Engine
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Immutable daily sales revenue, realized profit, and total in-stock inventory valuation snapshots
          </CardDescription>
        </div>

        {/* Time Period Filter Pills matching user specifications */}
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
          <div className="flex items-center gap-1 p-1 bg-muted/80 border border-border/80 rounded-xl w-max sm:w-auto min-w-full sm:min-w-0">
            {(
              [
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: 'This Month', value: 'this_month' },
                { label: '3 Months', value: '3m' },
                { label: '6 Months', value: '6m' },
                { label: 'Year', value: 'year' },
                { label: 'All Time', value: 'all' },
              ] as const
            ).map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`h-7 sm:h-7.5 px-2.5 sm:px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 whitespace-nowrap flex items-center justify-center ${
                  period === p.value
                    ? 'bg-white text-foreground shadow-xs font-bold ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val: any) => setActiveTab(val)}
        className="space-y-4 sm:space-y-5"
      >
        <div className="flex flex-col gap-2.5 sm:gap-3">
          {/* Mobile-optimized, scrollbar-free Tabs Switcher */}
          <div className="w-full overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
            <div className="bg-muted/80 border border-border/80 p-1 rounded-xl w-max sm:w-auto min-w-full sm:min-w-0 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('profit')}
                className={`h-8 sm:h-8.5 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'profit'
                    ? 'bg-white text-primary shadow-xs ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" /> Profits & Inventory Cost
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`h-8 sm:h-8.5 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'inventory'
                    ? 'bg-white text-primary shadow-xs ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Stock Velocity
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className={`h-8 sm:h-8.5 px-3 sm:px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'categories'
                    ? 'bg-white text-primary shadow-xs ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Category Breakdown
              </button>
            </div>
          </div>

          {/* Metric Active Toggles for Profit Tab */}
          {activeTab === 'profit' && (
            <div className="w-full overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap w-max sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowRevenue(!showRevenue)}
                  className={`flex items-center gap-1.5 h-7 sm:h-7.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showRevenue
                      ? 'bg-primary/10 text-primary border-primary/30 shadow-2xs font-bold'
                      : 'bg-muted/50 text-muted-foreground border-border/60 opacity-60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  Total Revenue
                </button>

                <button
                  type="button"
                  onClick={() => setShowProfit(!showProfit)}
                  className={`flex items-center gap-1.5 h-7 sm:h-7.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showProfit
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-bold'
                      : 'bg-muted/50 text-muted-foreground border-border/60 opacity-60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  Realized Profit
                </button>

                <button
                  type="button"
                  onClick={() => setShowInventoryCost(!showInventoryCost)}
                  className={`flex items-center gap-1.5 h-7 sm:h-7.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showInventoryCost
                      ? 'bg-violet-50 text-violet-700 border-violet-300 shadow-2xs font-bold'
                      : 'bg-muted/50 text-muted-foreground border-border/60 opacity-60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  Total Inventory Cost
                </button>
              </div>
            </div>
          )}

          {/* Metric Active Toggles for Inventory Velocity Tab */}
          {activeTab === 'inventory' && (
            <div className="w-full overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap w-max sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowInflow(!showInflow)}
                  className={`flex items-center gap-1.5 h-7 sm:h-7.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showInflow
                      ? 'bg-primary/10 text-primary border-primary/30 shadow-2xs font-bold'
                      : 'bg-muted/50 text-muted-foreground border-border/60 opacity-60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  Units Purchased (In)
                </button>

                <button
                  type="button"
                  onClick={() => setShowOutflow(!showOutflow)}
                  className={`flex items-center gap-1.5 h-7 sm:h-7.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showOutflow
                      ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-2xs font-bold'
                      : 'bg-muted/50 text-muted-foreground border-border/60 opacity-60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  Units Sold (Out)
                </button>

                <button
                  type="button"
                  onClick={() => setShowTotalUnits(!showTotalUnits)}
                  className={`flex items-center gap-1.5 h-7 sm:h-7.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    showTotalUnits
                      ? 'bg-violet-50 text-violet-700 border-violet-300 shadow-2xs font-bold'
                      : 'bg-muted/50 text-muted-foreground border-border/60 opacity-60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  In-Stock Units
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PROFIT, REVENUE & INVENTORY VALUATION GRAPH                        */}
        {/* ========================================================================= */}
        <TabsContent value="profit" className="space-y-4 sm:space-y-5 mt-0">
          {/* Summary Metric Strip matching User Specifications */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* Box 1: Total Revenue (Whole inventory sales in selected period: Cost + Profit) */}
            <div className="p-2.5 sm:p-3.5 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col justify-between overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-x-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-primary uppercase tracking-wider truncate">
                  Total Revenue
                </span>
                <span className="text-[9px] sm:text-[10px] text-primary font-semibold shrink-0">
                  {periodStats.unitsSold} sold
                </span>
              </div>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-primary font-mono mt-1 truncate tracking-tight">
                {formatMoney(periodStats.totalRevenue.toString())}
              </div>
              <p className="text-[9px] sm:text-[10px] text-primary/80 mt-0.5 font-medium truncate">
                Sales done (Cost + Profit)
              </p>
            </div>

            {/* Box 2: Realized Profit (Main profit: Selling Price - Cost Price) */}
            <div className="p-2.5 sm:p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col justify-between overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-x-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900 uppercase tracking-wider truncate">
                  Realized Profit
                </span>
                <span className="text-[9px] sm:text-[10px] text-emerald-700 font-semibold shrink-0">
                  {periodStats.marginPercent}% margin
                </span>
              </div>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-emerald-700 font-mono mt-1 truncate tracking-tight">
                {formatMoney(periodStats.totalProfit.toString())}
              </div>
              <p className="text-[9px] sm:text-[10px] text-emerald-800/80 mt-0.5 font-medium truncate">
                Profit on sold items (Sell − Cost)
              </p>
            </div>

            {/* Box 3: Total Inventory Cost (All item costs till now including total units) */}
            <div className="p-2.5 sm:p-3.5 bg-violet-50/70 border border-violet-200/80 rounded-2xl flex flex-col justify-between overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-x-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-violet-900 uppercase tracking-wider truncate">
                  Inventory Cost
                </span>
                <span className="text-[9px] sm:text-[10px] text-violet-700 font-semibold shrink-0">
                  {currentValuation.totalInStockUnits} units
                </span>
              </div>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-violet-700 font-mono mt-1 truncate tracking-tight">
                {formatMoney(currentValuation.totalInventoryCost.toString())}
              </div>
              <p className="text-[9px] sm:text-[10px] text-violet-800/80 mt-0.5 font-medium truncate">
                Total in-stock catalog cost
              </p>
            </div>

            {/* Box 4: Total Retail Valuation */}
            <div className="p-2.5 sm:p-3.5 bg-muted/50/90 border border-border/80 rounded-2xl flex flex-col justify-between overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-x-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                  Retail Value
                </span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-semibold shrink-0">
                  {currentValuation.totalCatalogItems} items
                </span>
              </div>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-foreground font-mono mt-1 truncate tracking-tight">
                {formatMoney(currentValuation.totalInventoryRetail.toString())}
              </div>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 font-medium truncate">
                Total customer billing value
              </p>
            </div>
          </div>

          {/* Interactive Recharts Graph */}
          <div className="h-64 sm:h-72 w-full pt-2 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTimeseries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="profGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl text-xs space-y-1.5 min-w-[180px]">
                        <p className="font-bold text-foreground border-b border-border/60 pb-1 flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-[10px] text-emerald-600 font-semibold">Snapshot</span>
                        </p>
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              {entry.name}:
                            </span>
                            <span className="font-mono font-bold text-foreground">
                              {formatMoney(entry.value.toString())}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {showRevenue && (
                  <Area
                    type="monotone"
                    dataKey="totalRevenue"
                    name="Sales Revenue"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revGradient)"
                  />
                )}
                {showProfit && (
                  <Area
                    type="monotone"
                    dataKey="totalProfit"
                    name="Realized Profit"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#profGradient)"
                  />
                )}
                {showInventoryCost && (
                  <Area
                    type="monotone"
                    dataKey="totalInventoryCost"
                    name="Total Inventory Cost"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#costGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: STOCK VELOCITY GRAPH                                               */}
        {/* ========================================================================= */}
        <TabsContent value="inventory" className="space-y-4 sm:space-y-5 mt-0">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="p-2.5 sm:p-3.5 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col justify-between overflow-hidden">
              <span className="text-[10px] sm:text-[11px] font-bold text-primary uppercase tracking-wider truncate">
                Purchased (In)
              </span>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-primary font-mono mt-1 truncate tracking-tight">
                +{periodStats.unitsPurchased} Units
              </div>
              <p className="text-[9px] sm:text-[10px] text-primary/80 mt-0.5 font-medium truncate">
                Incoming inventory
              </p>
            </div>

            <div className="p-2.5 sm:p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex flex-col justify-between overflow-hidden">
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-900 uppercase tracking-wider truncate">
                Sold (Out)
              </span>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-amber-700 font-mono mt-1 truncate tracking-tight">
                -{periodStats.unitsSold} Units
              </div>
              <p className="text-[9px] sm:text-[10px] text-amber-800/80 mt-0.5 font-medium truncate">
                Dispatched to clients
              </p>
            </div>

            <div className="p-2.5 sm:p-3.5 bg-violet-50/70 border border-violet-200/80 rounded-2xl flex flex-col justify-between overflow-hidden">
              <span className="text-[10px] sm:text-[11px] font-bold text-violet-900 uppercase tracking-wider truncate">
                In-Stock Units
              </span>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-violet-700 font-mono mt-1 truncate tracking-tight">
                {currentValuation.totalInStockUnits} Units
              </div>
              <p className="text-[9px] sm:text-[10px] text-violet-800/80 mt-0.5 font-medium truncate">
                Physical on hand
              </p>
            </div>

            <div className="p-2.5 sm:p-3.5 bg-muted/50/90 border border-border/80 rounded-2xl flex flex-col justify-between overflow-hidden">
              <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                Catalog Items
              </span>
              <div className="text-[13px] xs:text-sm sm:text-xl font-extrabold text-foreground font-mono mt-1 truncate tracking-tight">
                {currentValuation.totalCatalogItems}
              </div>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 font-medium truncate">
                Catalog SKU entries
              </p>
            </div>
          </div>

          {/* Interactive Recharts Graph */}
          <div className="h-64 sm:h-72 w-full pt-2 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTimeseries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="unitsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl text-xs space-y-1.5 min-w-[160px]">
                        <p className="font-bold text-foreground border-b border-border/60 pb-1">{label}</p>
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              {entry.name}:
                            </span>
                            <span className="font-mono font-bold text-foreground">
                              {entry.value} Units
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {showInflow && (
                  <Area
                    type="monotone"
                    dataKey="unitsPurchased"
                    name="Purchased (In)"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#inflowGrad)"
                  />
                )}
                {showOutflow && (
                  <Area
                    type="monotone"
                    dataKey="unitsSold"
                    name="Sold (Out)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#outflowGrad)"
                  />
                )}
                {showTotalUnits && (
                  <Area
                    type="monotone"
                    dataKey="totalInStockUnits"
                    name="In-Stock Units"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#unitsGrad)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: CATEGORIES BREAKDOWN                                               */}
        {/* ========================================================================= */}
        <TabsContent value="categories" className="space-y-4 mt-0">
          <div className="h-60 sm:h-64 w-full select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl text-xs space-y-1">
                        <p className="font-bold text-foreground">{label}</p>
                        <p className="text-primary font-mono font-semibold">{payload[0]?.value} Items in Category</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Items Count"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                  className="hover:opacity-80 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
