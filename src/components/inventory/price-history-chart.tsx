'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

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

  // Calculate price boundaries
  const { minPrice, maxPrice, priceRange, hasSelling, hasCost } = useMemo(() => {
    let allPrices: number[] = [];
    let hasS = false;
    let hasC = false;

    for (const r of chronoRecords) {
      if (r.sellingPrice && r.sellingPrice > 0) {
        allPrices.push(r.sellingPrice);
        hasS = true;
      }
      if (r.costPrice && r.costPrice > 0) {
        allPrices.push(r.costPrice);
        hasC = true;
      }
    }

    if (allPrices.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100, hasSelling: false, hasCost: false };
    }

    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const span = max - min;
    const padding = span > 0 ? span * 0.15 : max * 0.2;
    const computedMin = Math.max(0, Math.floor(min - padding));
    const computedMax = Math.ceil(max + padding);

    return {
      minPrice: computedMin,
      maxPrice: computedMax,
      priceRange: Math.max(1, computedMax - computedMin),
      hasSelling: hasS,
      hasCost: hasC,
    };
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

  // Chart dimensions & responsive layout (optimized for tall, prominent mobile & desktop display)
  const width = 480;
  const height = 280;
  const padLeft = 54;
  const padRight = 16;
  const padTop = 28;
  const padBottom = 38;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const n = chronoRecords.length;

  const getX = (i: number) => {
    if (n <= 1) return padLeft + chartW / 2;
    return padLeft + (i / (n - 1)) * chartW;
  };

  const getY = (val: number) => {
    return padTop + chartH - ((val - minPrice) / priceRange) * chartH;
  };

  // Build SVG Points for Selling Price & Cost Price
  const sellingPoints = chronoRecords
    .map((r, i) => (r.sellingPrice ? { x: getX(i), y: getY(r.sellingPrice), price: r.sellingPrice, record: r, idx: i } : null))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const costPoints = chronoRecords
    .map((r, i) => (r.costPrice ? { x: getX(i), y: getY(r.costPrice), price: r.costPrice, record: r, idx: i } : null))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // Helper for smooth cubic bezier curve
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const sellingLinePath = createSmoothPath(sellingPoints);
  const costLinePath = createSmoothPath(costPoints);

  const sellingAreaPath =
    sellingPoints.length > 1
      ? `${sellingLinePath} L ${sellingPoints[sellingPoints.length - 1].x} ${padTop + chartH} L ${sellingPoints[0].x} ${padTop + chartH} Z`
      : '';

  const costAreaPath =
    costPoints.length > 1
      ? `${costLinePath} L ${costPoints[costPoints.length - 1].x} ${padTop + chartH} L ${costPoints[0].x} ${padTop + chartH} Z`
      : '';

  // Grid levels (Min, Mid-Low, Mid-High, Max for 4 clear reference bands)
  const quarter1 = Math.round(minPrice + priceRange * 0.33);
  const quarter2 = Math.round(minPrice + priceRange * 0.66);
  const gridLevels = [
    { label: `${currencySymbol}${maxPrice.toLocaleString('en-IN')}`, y: padTop },
    { label: `${currencySymbol}${quarter2.toLocaleString('en-IN')}`, y: padTop + chartH * 0.33 },
    { label: `${currencySymbol}${quarter1.toLocaleString('en-IN')}`, y: padTop + chartH * 0.66 },
    { label: `${currencySymbol}${minPrice.toLocaleString('en-IN')}`, y: padTop + chartH },
  ];

  const activeRecord = hoveredIndex !== null ? chronoRecords[hoveredIndex] : null;

  const periods = [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'All', value: 'all' },
  ];

  // Mobile Touch scrubbing handler
  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || n <= 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const touchX = e.touches[0].clientX - rect.left;
    const scale = width / rect.width;
    const svgX = touchX * scale;

    const ratio = Math.max(0, Math.min(1, (svgX - padLeft) / chartW));
    const idx = Math.round(ratio * (n - 1));
    if (idx >= 0 && idx < n) {
      setHoveredIndex(idx);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 bg-slate-50/50 rounded-2xl border border-border/70">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2.5 text-xs font-semibold text-muted-foreground">Loading price trends...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-slate-50/60 rounded-2xl border border-border/70 border-dashed">
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
      {/* Top Controls & Metrics Bar — Fully responsive for mobile & desktop */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-1">
        {/* Trend Summary Badge & Count */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-100/90 border border-border/80 text-xs shadow-2xs">
            {trend.flat ? (
              <Minus className="h-3.5 w-3.5 text-slate-500" />
            ) : trend.up ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            )}
            <span
              className={`font-black font-mono ${
                trend.flat ? 'text-slate-600' : trend.up ? 'text-emerald-600' : 'text-rose-600'
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
                <span className="w-2 h-2 rounded-full bg-blue-600 shadow-2xs" />
                <span className="font-bold text-foreground">Cost</span>
              </div>
            )}
          </div>

          {/* Time range pills with scroll overflow for small screens */}
          <div className="flex items-center bg-slate-100/90 p-0.5 sm:p-1 rounded-xl border border-border shadow-2xs overflow-x-auto no-scrollbar">
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

      {/* Modern Responsive SVG Line Graph Card with Touch Scrubbing */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50/95 via-white to-slate-50/90 border border-border/80 shadow-blend p-3 sm:p-5">
        {/* SVG Viewport — Tall & prominent on all devices */}
        <div className="w-full touch-pan-x flex items-center justify-center min-h-[240px] sm:min-h-[280px]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none max-w-full"
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
          >
            <defs>
              {/* Selling Price Linear Gradient */}
              <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="70%" stopColor="#10b981" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>

              {/* Cost Price Linear Gradient */}
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.20" />
                <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>

              {/* Drop Shadow for active hover pin */}
              <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Horizontal Gridlines & Left Y-Axis Labels */}
            {gridLevels.map((g, idx) => (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={g.y}
                  x2={width - padRight}
                  y2={g.y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={idx === 1 || idx === 2 ? '4 4' : 'none'}
                />
                <text
                  x={padLeft - 8}
                  y={g.y + 4}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px] sm:text-[11px] font-semibold"
                >
                  {g.label}
                </text>
              </g>
            ))}

            {/* Translucent Area Fills */}
            {hasCost && costAreaPath && (
              <path d={costAreaPath} fill="url(#costGrad)" />
            )}
            {hasSelling && sellingAreaPath && (
              <path d={sellingAreaPath} fill="url(#sellGrad)" />
            )}

            {/* Main Connecting Curves */}
            {hasCost && costLinePath && (
              <path
                d={costLinePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-2xs"
              />
            )}
            {hasSelling && sellingLinePath && (
              <path
                d={sellingLinePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-2xs"
              />
            )}

            {/* Hover/Touch Guide Crosshair Line */}
            {hoveredIndex !== null && (
              <g>
                <line
                  x1={getX(hoveredIndex)}
                  y1={padTop}
                  x2={getX(hoveredIndex)}
                  y2={padTop + chartH}
                  stroke="#64748b"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="transition-all"
                />
              </g>
            )}

            {/* Cost Data Points */}
            {costPoints.map((pt) => {
              const isHovered = hoveredIndex === pt.idx;
              return (
                <g key={`cost-pt-${pt.idx}`} className="cursor-pointer">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 4.5}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter={isHovered ? 'url(#shadowGlow)' : undefined}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}

            {/* Selling Data Points */}
            {sellingPoints.map((pt) => {
              const isHovered = hoveredIndex === pt.idx;
              return (
                <g key={`sell-pt-${pt.idx}`} className="cursor-pointer">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 8 : 5}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    filter={isHovered ? 'url(#shadowGlow)' : undefined}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}

            {/* Invisible Large Hover Detection Columns */}
            {chronoRecords.map((r, i) => {
              const colX = n <= 1 ? padLeft : padLeft + (i === 0 ? 0 : (i - 0.5) / (n - 1)) * chartW;
              const colW = n <= 1 ? chartW : chartW / Math.max(1, n - 1);

              return (
                <rect
                  key={`col-${i}`}
                  x={colX}
                  y={padTop}
                  width={colW}
                  height={chartH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                />
              );
            })}

            {/* Bottom X-Axis Dates */}
            {chronoRecords.map((r, i) => {
              // Show label for every item if <= 5 records, otherwise show start, middle, and end
              const shouldShowLabel =
                n <= 5 || i === 0 || i === n - 1 || (n > 5 && i === Math.floor(n / 2));

              if (!shouldShowLabel) return null;

              const x = getX(i);
              const dateStr = new Date(r.createdAt).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <text
                  key={`date-${i}`}
                  x={x}
                  y={padTop + chartH + 18}
                  textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                  className={`text-[9px] sm:text-[10px] font-mono transition-colors ${
                    hoveredIndex === i ? 'fill-primary font-bold' : 'fill-slate-400 font-semibold'
                  }`}
                >
                  {dateStr}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Dynamic Tooltip on Active/Hovered Point — Fully Responsive */}
        {activeRecord && (
          <div className="mt-2 sm:mt-3 p-2.5 sm:p-3.5 bg-white/95 backdrop-blur-md rounded-xl border border-primary/30 shadow-md flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-[11px] sm:text-xs shrink-0">
                #{activeRecord.shortCode || '—'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {activeRecord.supplierName || 'Unnamed Supplier'}
                </p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                  {new Date(activeRecord.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 text-right ml-auto">
              {activeRecord.costPrice && (
                <div className="bg-blue-50/80 px-2 sm:px-2.5 py-1 rounded-lg border border-blue-200">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-700">Cost</p>
                  <p className="text-xs sm:text-sm font-black font-mono text-blue-900">
                    {formatMoney(Number(activeRecord.costPrice))}
                  </p>
                </div>
              )}
              {activeRecord.sellingPrice && (
                <div className="bg-emerald-50/80 px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-200">
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-700">Sell</p>
                  <p className="text-xs sm:text-sm font-black font-mono text-emerald-900">
                    {formatMoney(Number(activeRecord.sellingPrice))}
                  </p>
                </div>
              )}
              {activeRecord.sellingPrice && activeRecord.costPrice && (
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Margin</p>
                  <p className="text-xs font-black font-mono text-primary">
                    +{Math.round(((Number(activeRecord.sellingPrice) - Number(activeRecord.costPrice)) / Number(activeRecord.costPrice)) * 100)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:py-2.5 sm:px-3.5 rounded-xl border transition-all gap-2 sm:gap-3 ${
                hoveredIndex !== null && chronoRecords[hoveredIndex]?.id === record.id
                  ? 'bg-primary/5 border-primary/40 shadow-xs'
                  : 'bg-white border-border/80 shadow-2xs hover:border-primary/30'
              }`}
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
                  <Badge variant="outline" className="text-xs font-mono bg-blue-50/50 text-blue-900 border-blue-200">
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
