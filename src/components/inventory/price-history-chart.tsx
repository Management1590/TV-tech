'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Calendar,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/config/currency';

interface PriceRecord {
  id: string;
  costPrice: number | null;
  sellingPrice: number | null;
  supplierName: string;
  shortCode?: string;
  createdAt: string;
}

interface PriceHistoryChartProps {
  itemId: string;
  currencySymbol?: string;
}

export function PriceHistoryChart({ itemId, currencySymbol = '₹' }: PriceHistoryChartProps) {
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<string>('all');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/inventory/items/${itemId}/price-history?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(data.records ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [itemId, period]);

  // Chronological order (Oldest -> Newest, Left -> Right)
  const chronoRecords = useMemo(() => {
    return [...records].reverse();
  }, [records]);

  // Has selling or cost data
  const { hasSelling, hasCost } = useMemo(() => {
    let hasS = false;
    let hasC = false;
    for (const r of chronoRecords) {
      if (r.sellingPrice && r.sellingPrice > 0) hasS = true;
      if (r.costPrice && r.costPrice > 0) hasC = true;
    }
    return { hasSelling: hasS, hasCost: hasC };
  }, [chronoRecords]);

  // Overall selling price trend calculation
  const trend = useMemo(() => {
    const validSelling = chronoRecords
      .map((r) => r.sellingPrice)
      .filter((p): p is number => p !== null && p > 0);

    if (validSelling.length < 2) {
      const singlePrice = validSelling[0] || 0;
      return { percent: '0.0', up: false, flat: true, start: singlePrice, latest: singlePrice };
    }

    const first = validSelling[0];
    const latest = validSelling[validSelling.length - 1];
    const diff = latest - first;
    const pct = first > 0 ? ((diff / first) * 100).toFixed(1) : '0.0';

    return {
      percent: Math.abs(parseFloat(pct)).toFixed(1),
      up: diff > 0,
      flat: diff === 0,
      start: first,
      latest: latest,
    };
  }, [chronoRecords]);

  // Format timeseries data for Recharts
  const chartData = useMemo(() => {
    return chronoRecords.map((r, idx) => {
      const d = new Date(r.createdAt);
      const displayDate = !isNaN(d.getTime())
        ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : `B${idx + 1}`;

      return {
        id: r.id,
        displayDate,
        costPrice: r.costPrice && r.costPrice > 0 ? Number(r.costPrice) : undefined,
        sellingPrice: r.sellingPrice && r.sellingPrice > 0 ? Number(r.sellingPrice) : undefined,
        supplierName: r.supplierName || 'Supplier',
        shortCode: r.shortCode,
        createdAt: r.createdAt,
      };
    });
  }, [chronoRecords]);

  const periods = [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'All', value: 'all' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 bg-muted/50 rounded-2xl border border-border/70">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2.5 text-xs font-semibold text-muted-foreground">Loading price trends...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-muted/60 rounded-2xl border border-border/70 border-dashed">
        <Tag className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">No price history recorded yet</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Price changes and batch arrivals will automatically generate an interactive line graph here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Controls & Metrics Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-1">
        {/* Trend Summary Badge & Count */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-muted/90 border border-border/80 text-xs shadow-2xs">
            {trend.flat ? (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            ) : trend.up ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            )}
            <span
              className={`font-black font-mono ${
                trend.flat ? 'text-foreground/80' : trend.up ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.flat ? 'Stable' : `${trend.up ? '+' : '-'}${trend.percent}%`}
            </span>
            <span className="text-muted-foreground font-medium">trend</span>
          </div>

          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">
            {records.length} batch{records.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {/* Legend & Filter Time Range Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
          {/* Chart Legend */}
          <div className="flex items-center gap-2.5 text-[11px] sm:text-xs">
            {hasSelling && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs" />
                <span className="font-bold text-foreground">Selling</span>
              </div>
            )}
            {hasCost && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary shadow-2xs" />
                <span className="font-bold text-foreground">Cost</span>
              </div>
            )}
          </div>

          {/* Time range pills */}
          <div className="flex items-center bg-muted/90 p-0.5 sm:p-1 rounded-xl border border-border shadow-2xs overflow-x-auto no-scrollbar">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  period === p.value
                    ? 'bg-white text-primary shadow-xs font-black'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Responsive Recharts Graph Card — Same compact height as Dashboard (h-64 sm:h-72) */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-border/80 shadow-blend p-3 sm:p-4">
        <div className="h-64 sm:h-72 w-full pt-1 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                {/* Selling Price Linear Gradient */}
                <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>

                {/* Cost Price Linear Gradient */}
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#155EEF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#155EEF" stopOpacity={0.0} />
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
                width={46}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="p-2.5 sm:p-3 bg-white/95 backdrop-blur-md border border-border shadow-xl rounded-2xl text-xs space-y-1.5 min-w-[190px]">
                      <div className="flex items-center justify-between border-b border-border/60 pb-1 font-bold text-foreground">
                        <span>{label}</span>
                        {data?.shortCode && (
                          <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20 py-0">
                            #{data.shortCode.replace(/^#+/, '').toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      {data?.supplierName && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          Supplier: <strong className="text-foreground">{data.supplierName}</strong>
                        </p>
                      )}
                      <div className="space-y-1 pt-0.5">
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
                    </div>
                  );
                }}
              />
              {hasSelling && (
                <Area
                  type="monotone"
                  dataKey="sellingPrice"
                  name="Selling Price"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#sellGrad)"
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
              {hasCost && (
                <Area
                  type="monotone"
                  dataKey="costPrice"
                  name="Cost Price"
                  stroke="#155EEF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#costGrad)"
                  dot={{ r: 4, fill: '#155EEF', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#155EEF', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Batch Ledger Table — Responsive */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Historical Batch Log ({records.length})
        </h4>
        <div className="space-y-2">
          {records.map((record, idx) => (
            <div
              key={record.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:py-2.5 sm:px-3.5 rounded-xl border bg-white border-border/80 shadow-2xs hover:border-primary/30 transition-all gap-2 sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground">{record.supplierName}</span>
                  {idx === 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-bold px-1.5 py-0">
                      Latest
                    </Badge>
                  )}
                  {record.shortCode && (
                    <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/20 bg-primary/10 px-1.5 py-0">
                      #{record.shortCode}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                  {new Date(record.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-border/50">
                {record.costPrice != null && (
                  <Badge variant="outline" className="text-xs font-mono bg-primary/5 text-primary border-primary/20">
                    Cost: {formatMoney(Number(record.costPrice))}
                  </Badge>
                )}
                {record.sellingPrice != null && (
                  <Badge variant="secondary" className="text-xs font-mono bg-emerald-50 text-emerald-900 border-emerald-200 font-bold">
                    Sell: {formatMoney(Number(record.sellingPrice))}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
