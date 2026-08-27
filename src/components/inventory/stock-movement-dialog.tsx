'use client';

import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  ArrowDownUp,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Package,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  Flame,
  X,
  ShieldAlert,
  ChevronRight,
  ArrowLeft,
  ChevronsRight,
  Info,
  Check,
  SlidersHorizontal,
  Hash,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  recordStockMovementAction,
  markItemSoldOutAction,
  refillUnlimitedItemAction,
} from '@/features/inventory/actions/item.actions';

interface StockMovementDialogProps {
  itemId: string;
  itemName: string;
  currentQuantity: number | null;
  quantityMode?: string;
  isOutOfStock?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

type Mode = 'SOLD' | 'PURCHASE';
type ViewState = 'FORM' | 'WARNING_REVIEW' | 'SLIDE_SOLD_OUT' | 'SUCCESS_ANIMATION';

// ============================================================================
// PREMIUM "SLIDE TO CONFIRM" COMPONENT
// ============================================================================
interface SlideToConfirmProps {
  onConfirm: () => void;
  isLoading: boolean;
  label?: string;
  confirmedLabel?: string;
  variant?: 'danger' | 'success';
}

function SlideToConfirm({
  onConfirm,
  isLoading,
  label = 'Slide to Confirm Sold Out',
  confirmedLabel = 'Setting to Out of Stock...',
  variant = 'danger',
}: SlideToConfirmProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [dragWidth, setDragWidth] = useState(240);
  const x = useMotionValue(0);

  const isSuccess = variant === 'success';

  useEffect(() => {
    if (containerRef.current) {
      // Thumb is 48px, padding is 4px on each side
      setDragWidth(containerRef.current.clientWidth - 56);
    }
  }, []);

  const textOpacity = useTransform(x, [0, dragWidth * 0.6], [1, 0]);
  const trackBg = useTransform(
    x,
    [0, dragWidth],
    isSuccess
      ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.95)']
      : ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.95)']
  );

  const handleDragEnd = () => {
    if (x.get() >= dragWidth * 0.85 && !isConfirmed && !isLoading) {
      setIsConfirmed(true);
      x.set(dragWidth);
      onConfirm();
    } else {
      x.set(0);
    }
  };

  return (
    <div className="space-y-1.5 select-none">
      <motion.div
        ref={containerRef}
        style={{ background: trackBg }}
        className={`relative w-full h-14 rounded-2xl border-2 flex items-center p-1 overflow-hidden shadow-inner cursor-grab active:cursor-grabbing transition-colors ${
          isSuccess ? 'border-emerald-500/50' : 'border-red-500/50'
        }`}
      >
        {/* Animated Background Progress Fill */}
        <motion.div
          style={{ width: x }}
          className={`absolute inset-y-0 left-0 pointer-events-none rounded-xl ${
            isSuccess ? 'bg-emerald-600/30' : 'bg-red-600/30'
          }`}
        />

        {/* Center Label Text */}
        <motion.div
          style={{ opacity: isConfirmed ? 0 : textOpacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            className={`flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider ${
              isSuccess ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            <span>{label}</span>
            <ChevronsRight
              className={`w-4 h-4 animate-pulse ${
                isSuccess ? 'text-emerald-600' : 'text-red-600'
              }`}
            />
          </div>
        </motion.div>

        {/* Confirmed / Loading State Text */}
        {(isConfirmed || isLoading) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-white font-black text-xs uppercase tracking-wider">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{confirmedLabel}</span>
            </div>
          </div>
        )}

        {/* Draggable Slider Thumb */}
        <motion.div
          drag={isConfirmed || isLoading ? false : 'x'}
          dragConstraints={{ left: 0, right: dragWidth }}
          dragElastic={0.05}
          dragSnapToOrigin={false}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className={`relative z-10 w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-lg border cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-transform ${
            isSuccess
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/40 border-emerald-400'
              : 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-600/40 border-red-400'
          }`}
        >
          {isLoading || isConfirmed ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isSuccess ? (
            <Sparkles className="w-5 h-5 animate-pulse" />
          ) : (
            <Flame className="w-5 h-5 animate-pulse" />
          )}
        </motion.div>
      </motion.div>
      <p className="text-[11px] text-center text-muted-foreground font-medium">
        {isSuccess
          ? '👉 Drag the sparkles all the way to the right to confirm refill'
          : '👉 Drag the flame all the way to the right to confirm'}
      </p>
    </div>
  );
}

// ============================================================================
// MAIN STOCK MOVEMENT DIALOG
// ============================================================================
export function StockMovementDialog({
  itemId,
  itemName,
  currentQuantity,
  quantityMode = 'NUMERIC',
  isOutOfStock = false,
  isOpen,
  onOpenChange,
  trigger,
}: StockMovementDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Workflow View Management
  const [view, setView] = useState<ViewState>('FORM');

  // Form States
  const [mode, setMode] = useState<Mode>('SOLD');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Option to Keep Unlimited vs Convert to Numeric (for Unlimited items)
  const [targetQuantityMode, setTargetQuantityMode] = useState<'UNKNOWN' | 'NUMERIC'>('UNKNOWN');
  const [resultingNumericQty, setResultingNumericQty] = useState<number>(1);

  // Animation state after success
  const [animationData, setAnimationData] = useState<{
    prev: number | string;
    next: number | string;
    delta: number;
    mode: Mode | 'SOLDOUT' | 'REFILL';
  } | null>(null);

  const [animatedNumber, setAnimatedNumber] = useState<number | string>(0);

  const isUnlimited = quantityMode === 'UNKNOWN';
  const currentQty = isUnlimited ? (isOutOfStock ? 0 : 1) : Math.max(0, currentQuantity ?? 0);
  const isSold = mode === 'SOLD';

  // Resulting stock calculation
  const calculatedNext = isUnlimited
    ? targetQuantityMode === 'NUMERIC'
      ? `${resultingNumericQty} units`
      : '∞ In Stock'
    : isSold
    ? Math.max(0, currentQty - quantity)
    : currentQty + quantity;

  // Reset states on dialog open
  useEffect(() => {
    if (isOpen) {
      setView('FORM');
      setMode('SOLD');
      setQuantity(1);
      setNotes('');
      setTargetQuantityMode(isUnlimited ? 'UNKNOWN' : 'NUMERIC');
      setResultingNumericQty(1);
      setAnimationData(null);
    }
  }, [isOpen, isUnlimited]);

  // Adjust quantity
  const handleQuantityChange = (newVal: number) => {
    if (isNaN(newVal) || newVal < 1) {
      setQuantity(1);
      return;
    }

    // For numeric stock, clamp to currentQty
    if (!isUnlimited && isSold && currentQty > 0) {
      if (newVal > currentQty) {
        setQuantity(currentQty);
        toast.warning(`Cannot exceed available stock of ${currentQty} units.`);
        return;
      }
    }

    setQuantity(newVal);
  };

  // Rolling number counter animation when animationData is active
  useEffect(() => {
    if (!animationData) return;

    if (typeof animationData.prev === 'number' && typeof animationData.next === 'number') {
      let start = animationData.prev;
      const end = animationData.next;
      const duration = 1200; // ms
      const startTime = performance.now();

      const updateCounter = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.round(start + (end - start) * easeProgress);

        setAnimatedNumber(currentVal);

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          setAnimatedNumber(end);
        }
      };

      setAnimatedNumber(start);
      const animationFrame = requestAnimationFrame(updateCounter);

      const timer = setTimeout(() => {
        onOpenChange(false);
        router.refresh();
      }, 2800);

      return () => {
        cancelAnimationFrame(animationFrame);
        clearTimeout(timer);
      };
    } else {
      setAnimatedNumber(animationData.next);
      const timer = setTimeout(() => {
        onOpenChange(false);
        router.refresh();
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [animationData, onOpenChange, router]);

  // Step 1: Open Warning Review Screen
  const handleProceedToWarning = () => {
    if (quantity <= 0) {
      toast.error('Please enter a valid quantity of at least 1.');
      return;
    }

    if (!isUnlimited && isSold && quantity > currentQty) {
      toast.error(`Cannot sell ${quantity} units when only ${currentQty} are available.`);
      return;
    }

    // Set default resulting numeric quantity if user decides to convert to Numeric
    setResultingNumericQty(isSold ? 0 : quantity);
    setTargetQuantityMode(isUnlimited ? 'UNKNOWN' : 'NUMERIC');
    setView('WARNING_REVIEW');
  };

  // Step 2: Final Commit Stock Movement
  const handleConfirmMovement = () => {
    startTransition(async () => {
      const res = await recordStockMovementAction({
        itemId,
        movementType: isSold ? 'SALE' : 'PURCHASE',
        quantityChange: isSold ? -quantity : quantity,
        notes: notes.trim() || undefined,
        targetQuantityMode: isUnlimited ? targetQuantityMode : undefined,
        resultingNumericQuantity: isUnlimited && targetQuantityMode === 'NUMERIC' ? resultingNumericQty : undefined,
      });

      if (res.success) {
        setAnimationData({
          prev: isUnlimited ? (isOutOfStock ? '0 (Sold Out)' : '∞ (In Stock)') : (res.previousQuantity ?? 0),
          next: isUnlimited
            ? targetQuantityMode === 'NUMERIC'
              ? `${resultingNumericQty} units`
              : '∞ (In Stock)'
            : (res.newQuantity ?? 0),
          delta: quantity,
          mode,
        });
        setView('SUCCESS_ANIMATION');
        toast.success(
          isUnlimited && targetQuantityMode === 'NUMERIC'
            ? `Recorded movement & converted item to numeric (${resultingNumericQty} in stock)`
            : isSold
            ? `Successfully recorded sale of ${quantity} unit(s)`
            : `Successfully recorded purchase of ${quantity} unit(s)`
        );
      } else {
        toast.error(res.error || 'Failed to record stock movement.');
      }
    });
  };

  // Quick 1-Click Refill Action for Unlimited Stock
  const handleQuickRefill = () => {
    startTransition(async () => {
      const res = await refillUnlimitedItemAction(itemId, quantity || 1, 'Quick Refill / Restock');
      if (res.success) {
        setAnimationData({
          prev: '0 (Sold Out)',
          next: '∞ (In Stock)',
          delta: quantity || 1,
          mode: 'REFILL',
        });
        setView('SUCCESS_ANIMATION');
        toast.success('Product successfully REFILLED and marked in stock!');
      } else {
        toast.error(res.error || 'Failed to refill product stock.');
      }
    });
  };

  // Handle Mark as Sold Out (via Slide to Confirm)
  const handleConfirmSoldOut = () => {
    startTransition(async () => {
      const res = await markItemSoldOutAction(itemId);
      if (res.success) {
        setAnimationData({
          prev: isUnlimited ? '∞ (In Stock)' : (res.previousQuantity ?? 0),
          next: isUnlimited ? '0 (Sold Out)' : 0,
          delta: isUnlimited ? 1 : (res.previousQuantity ?? 0),
          mode: 'SOLDOUT',
        });
        setView('SUCCESS_ANIMATION');
        toast.success('Item has been marked as SOLD OUT');
      } else {
        toast.error(res.error || 'Failed to mark item as sold out.');
        setView('FORM');
      }
    });
  };

  return (
    <>
      {trigger && (
        <div onClick={() => onOpenChange(true)} className="inline-block">
          {trigger}
        </div>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(val) => {
          if (!isPending && view !== 'SUCCESS_ANIMATION') {
            onOpenChange(val);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-1.5rem)] max-w-[440px] sm:max-w-[460px] bg-white border border-slate-200/90 text-foreground p-0 overflow-hidden shadow-2xl rounded-3xl"
        >
          <AnimatePresence mode="wait">
            {/* ========================================================================= */}
            {/* VIEW 1: LIVE QUANTITY CHANGE CELEBRATION ANIMATION                       */}
            {/* ========================================================================= */}
            {view === 'SUCCESS_ANIMATION' && animationData && (
              <motion.div
                key="success-view"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="px-6 py-6 sm:p-7 flex flex-col items-center justify-center text-center space-y-4"
              >
                {/* Glowing Aura Ring */}
                <div
                  className={`w-24 h-24 rounded-3xl flex items-center justify-center border-2 transition-all duration-500 shadow-2xl ${
                    animationData.mode === 'PURCHASE' || animationData.mode === 'REFILL'
                      ? 'bg-emerald-950/60 border-emerald-500/80 shadow-[0_0_50px_rgba(16,185,129,0.45)] text-emerald-400'
                      : 'bg-red-950/60 border-red-500/80 shadow-[0_0_50px_rgba(239,68,68,0.45)] text-red-400'
                  }`}
                >
                  {animationData.mode === 'PURCHASE' || animationData.mode === 'REFILL' ? (
                    <TrendingUp className="w-12 h-12 stroke-[2.5] animate-bounce" />
                  ) : animationData.mode === 'SOLDOUT' ? (
                    <Flame className="w-12 h-12 stroke-[2.5] animate-pulse" />
                  ) : (
                    <TrendingDown className="w-12 h-12 stroke-[2.5] animate-bounce" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`text-xs font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full border ${
                        animationData.mode === 'PURCHASE' || animationData.mode === 'REFILL'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}
                    >
                      {animationData.mode === 'REFILL'
                        ? 'Stock Refilled & In Stock'
                        : animationData.mode === 'PURCHASE'
                        ? `+${animationData.delta} Units Added`
                        : animationData.mode === 'SOLDOUT'
                        ? 'Item Set to Sold Out'
                        : `-${animationData.delta} Units Deducted`}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground truncate max-w-[340px]">
                    {itemName}
                  </h3>
                </div>

                {/* Rolling Quantity Counter Display */}
                <div className="w-full bg-slate-50 border border-border/80 rounded-2xl p-5 shadow-inner flex items-center justify-around">
                  <div className="text-center">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Previous State
                    </p>
                    <p className="text-xl sm:text-2xl font-bold font-mono text-slate-700">
                      {animationData.prev}
                    </p>
                  </div>

                  <div className="text-slate-400 font-bold text-xl">➔</div>

                  <div className="text-center">
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        animationData.mode === 'PURCHASE' || animationData.mode === 'REFILL'
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      Updated State
                    </p>
                    <motion.p
                      key={String(animatedNumber)}
                      initial={{ scale: 1.25 }}
                      animate={{ scale: 1 }}
                      className={`text-2xl sm:text-4xl font-black font-mono tracking-tight ${
                        animationData.mode === 'PURCHASE' || animationData.mode === 'REFILL'
                          ? 'text-emerald-600'
                          : animationData.next === 0 || animationData.next === '0 (Sold Out)'
                          ? 'text-red-600 font-black'
                          : 'text-red-600'
                      }`}
                    >
                      {animatedNumber}
                    </motion.p>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    onOpenChange(false);
                    router.refresh();
                  }}
                  className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Done & Return
                </Button>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 2: HIGH-IMPACT WARNING & VERIFICATION SCREEN                        */}
            {/* ========================================================================= */}
            {view === 'WARNING_REVIEW' && (
              <motion.div
                key="warning-review-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4 sm:p-6 space-y-3 sm:space-y-4"
              >
                {/* Header with Back Button */}
                <div className="flex items-center gap-2.5 pb-2 sm:pb-3 border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => setView('FORM')}
                    disabled={isPending}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm sm:text-base font-black text-foreground flex items-center gap-1.5">
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 ${isSold ? 'text-red-600' : 'text-emerald-600'}`}
                      />
                      {isSold ? 'Confirm Stock Reduction' : 'Confirm Stock Addition'}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-[320px]">
                      {itemName}
                    </p>
                  </div>
                </div>

                {/* EXACT QUANTITY LOSS / GAIN HIGHLIGHT CARD */}
                <div
                  className={`p-3.5 sm:p-5 rounded-2xl border-2 space-y-2.5 sm:space-y-3 ${
                    isSold
                      ? 'bg-gradient-to-br from-red-50/90 via-rose-50/70 to-white border-red-300 shadow-lg shadow-red-500/10'
                      : 'bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-white border-emerald-300 shadow-lg shadow-emerald-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isSold ? 'text-red-800' : 'text-emerald-800'
                      }`}
                    >
                      {isSold ? (
                        <>
                          <TrendingDown className="w-4 h-4 text-red-600" /> Quantity Leaving Inventory
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4 text-emerald-600" /> Quantity Entering Inventory
                        </>
                      )}
                    </span>
                    <Badge
                      className={`font-mono text-xs font-black px-2.5 py-0.5 ${
                        isSold
                          ? 'bg-red-600 text-white border-none'
                          : 'bg-emerald-600 text-white border-none'
                      }`}
                    >
                      {isSold ? `−${quantity} UNITS` : `+${quantity} UNITS`}
                    </Badge>
                  </div>

                  {/* Visual Calculation Metric Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div className="p-2.5 rounded-xl bg-white/80 border border-border/80">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Current</p>
                      <p className="text-sm sm:text-base font-black font-mono text-slate-800">
                        {isUnlimited ? (isOutOfStock ? '0 (OOS)' : '∞ (Stock)') : currentQty}
                      </p>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isSold
                          ? 'bg-red-100/80 border-red-300 text-red-900'
                          : 'bg-emerald-100/80 border-emerald-300 text-emerald-900'
                      }`}
                    >
                      <p className="text-[10px] uppercase font-bold">
                        {isSold ? 'Deduct' : 'Add'}
                      </p>
                      <p className="text-sm sm:text-base font-black font-mono">
                        {isSold ? `−${quantity}` : `+${quantity}`}
                      </p>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        !isUnlimited && calculatedNext === 0
                          ? 'bg-red-600 text-white border-red-700'
                          : 'bg-white/80 border-border/80 text-slate-900'
                      }`}
                    >
                      <p
                        className={`text-[10px] uppercase font-bold ${
                          !isUnlimited && calculatedNext === 0 ? 'text-white/80' : 'text-muted-foreground'
                        }`}
                      >
                        Resulting
                      </p>
                      <p className="text-sm sm:text-base font-black font-mono">
                        {isUnlimited ? '∞ In Stock' : calculatedNext}
                      </p>
                    </div>
                  </div>

                  {/* Impact Alert Warnings */}
                  {!isUnlimited && isSold && calculatedNext === 0 && (
                    <div className="p-3 bg-red-600 text-white rounded-xl text-xs font-bold flex items-start gap-2 shadow-sm animate-pulse">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        CRITICAL WARNING: This sale will leave 0 units in stock! The product will be marked as OUT OF STOCK.
                      </span>
                    </div>
                  )}

                  {!isUnlimited && isSold && typeof calculatedNext === 'number' && calculatedNext > 0 && calculatedNext <= 2 && (
                    <div className="p-3 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        Low Stock Alert: Only {calculatedNext} unit(s) will remain in inventory after this sale.
                      </span>
                    </div>
                  )}

                  {isUnlimited && (
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white border border-border/80 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                          Stock Tracking Mode Moving Forward:
                        </span>
                        <span className="text-[10px] font-extrabold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          Select Mode
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Option 1: Keep as Unlimited Stock */}
                        <button
                          type="button"
                          onClick={() => setTargetQuantityMode('UNKNOWN')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            targetQuantityMode === 'UNKNOWN'
                              ? 'bg-blue-50/90 border-blue-500 shadow-xs ring-2 ring-blue-500/20'
                              : 'bg-slate-50 hover:bg-slate-100/80 border-border/80 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                              Keep as Unlimited (∞)
                            </span>
                            {targetQuantityMode === 'UNKNOWN' && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                            Uncounted small part. Counts as 1 valuation unit in dashboard.
                          </p>
                        </button>

                        {/* Option 2: Change to Numeric Stock */}
                        <button
                          type="button"
                          onClick={() => setTargetQuantityMode('NUMERIC')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            targetQuantityMode === 'NUMERIC'
                              ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                              : 'bg-slate-50 hover:bg-slate-100/80 border-border/80 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                              <Hash className="w-3.5 h-3.5 text-emerald-600" />
                              Change to Numeric (#)
                            </span>
                            {targetQuantityMode === 'NUMERIC' && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </div>
                          <p className="text-[11px] text-emerald-800/80 mt-1 leading-snug">
                            Convert item to exact count tracking with active stock balance.
                          </p>
                        </button>
                      </div>

                      {/* If Numeric Selected: Adjustable resulting count */}
                      {targetQuantityMode === 'NUMERIC' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2.5 mt-1 border-t border-border/60 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-emerald-950">
                              Resulting In-Stock Balance:
                            </p>
                            <p className="text-[11px] text-emerald-800/80">
                              Item will show this exact in-stock unit count.
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setResultingNumericQty(Math.max(0, resultingNumericQty - 1))}
                              className="h-8 w-8 p-0 rounded-lg border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min={0}
                              value={resultingNumericQty}
                              onChange={(e) => setResultingNumericQty(Math.max(0, parseInt(e.target.value) || 0))}
                              className="h-8 w-16 text-center font-mono font-black text-xs rounded-lg border-emerald-300 bg-white text-emerald-950"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setResultingNumericQty(resultingNumericQty + 1)}
                              className="h-8 w-8 p-0 rounded-lg border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                {/* Optional Note / Remarks */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Movement Notes / Reason (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. Counter sale, client repair, bulk supplier purchase..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isPending}
                    className="h-10 text-xs rounded-xl bg-slate-50 border-border"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setView('FORM')}
                    disabled={isPending}
                    className="flex-1 h-11 rounded-2xl text-xs font-bold border-border bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    ← Edit Details
                  </Button>

                  <Button
                    type="button"
                    onClick={handleConfirmMovement}
                    disabled={isPending}
                    className={`flex-1 h-11 rounded-2xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer ${
                      isSold
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/30'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/30'
                    }`}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Recording...
                      </>
                    ) : isSold ? (
                      `Confirm & Deduct (${quantity})`
                    ) : (
                      `Confirm & Add (${quantity})`
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 3: SLIDE TO CONFIRM "SOLD OUT / 0 QUANTITY" SCREEN                  */}
            {/* ========================================================================= */}
            {view === 'SLIDE_SOLD_OUT' && (
              <motion.div
                key="slide-sold-out-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-4 sm:p-6 space-y-3 sm:space-y-4"
              >
                {/* Header */}
                <div className="flex items-center gap-2.5 pb-2 sm:pb-3 border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => setView('FORM')}
                    disabled={isPending}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm sm:text-base font-black text-red-600 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-red-600 shrink-0" />
                      Mark Product as Sold Out
                    </h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-[320px]">
                      {itemName}
                    </p>
                  </div>
                </div>

                {/* Warning Context Card */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-red-50/80 border border-red-200/90 text-xs text-red-950 space-y-1.5">
                  <div className="flex items-center gap-2 text-red-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Permanent Stock Depletion Action</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-red-800/90">
                    {isUnlimited
                      ? 'This will record 1 item sold with realized profit/revenue in admin dashboard analytics and mark this unlimited product as OUT OF STOCK.'
                      : `This will record all ${currentQty} remaining item(s) sold with full profit/revenue in admin dashboard analytics and zero out stock balance.`}
                  </p>
                </div>

                {/* SLIDE TO CONFIRM WIDGET */}
                <div className="pt-1">
                  <SlideToConfirm
                    onConfirm={handleConfirmSoldOut}
                    isLoading={isPending}
                    label="Slide to Confirm Sold Out"
                    confirmedLabel="Zeroing Stock..."
                  />
                </div>

                {/* Cancel Button */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setView('FORM')}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold underline underline-offset-4 cursor-pointer"
                  >
                    Cancel and return to stock form
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 4: MAIN STOCK MOVEMENT FORM (SOLD / PURCHASE)                       */}
            {/* ========================================================================= */}
            {view === 'FORM' && (
              <motion.div
                key="form-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 sm:p-6 space-y-3 sm:space-y-3.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-border/60">
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <DialogTitle className="text-sm sm:text-base font-black text-foreground flex items-center gap-1.5">
                      <ArrowDownUp className="w-4 h-4 text-primary shrink-0" />
                      Record Stock Movement
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground truncate max-w-[280px] sm:max-w-[340px]">
                      {itemName}
                    </DialogDescription>
                  </div>

                  {/* Close button for one-tap dismissal */}
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* DUAL MODE SELECTOR: SOLD (Red) vs PURCHASE (Green) */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl sm:rounded-2xl border border-border/80">
                  {/* SOLD Button (Default) */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('SOLD');
                      if (!isUnlimited && quantity > currentQty && currentQty > 0) {
                        setQuantity(currentQty);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      isSold
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-red-600/30'
                        : 'text-slate-600 hover:text-red-600 hover:bg-white/60'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    Item Sold (−)
                  </button>

                  {/* PURCHASE Button */}
                  <button
                    type="button"
                    onClick={() => setMode('PURCHASE')}
                    className={`flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      !isSold
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/30'
                        : 'text-slate-600 hover:text-emerald-600 hover:bg-white/60'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Purchase (+)
                  </button>
                </div>

                {/* Current Stock Banner */}
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-border/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                    <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Current Inventory:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[11px] sm:text-xs font-extrabold px-2 py-0.5 ${
                        isOutOfStock
                          ? 'bg-red-50 text-red-600 border-red-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isOutOfStock
                        ? '0 units (Sold Out)'
                        : isUnlimited
                        ? 'Unlimited (∞ Stock)'
                        : `${currentQty} units available`}
                    </Badge>
                  </div>
                </div>

                {/* QUICK REFILL SLIDE TO CONFIRM FOR UNLIMITED STOCK ITEMS IN PURCHASE MODE */}
                {isUnlimited && !isSold && (
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/80 border border-emerald-200/90 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          Quick Refill Stock (Back in Stock)
                        </p>
                        <p className="text-[11px] text-emerald-800/90 leading-tight">
                          Slide across to mark product as active in-stock immediately.
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5">
                        1 Unit Refill
                      </Badge>
                    </div>

                    <div className="pt-1">
                      <SlideToConfirm
                        onConfirm={handleQuickRefill}
                        isLoading={isPending}
                        variant="success"
                        label="Slide to Confirm Refill"
                        confirmedLabel="Refilling Stock..."
                      />
                    </div>
                  </div>
                )}

                {/* NUMBER INPUT + STEPPERS */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>
                      {isSold ? 'Quantity Sold (Deduct)' : 'Quantity Purchased (Add)'}
                    </span>
                    <span
                      className={`text-xs font-mono font-black ${
                        isSold ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {isSold ? `−${quantity} units` : `+${quantity} units`}
                    </span>
                  </Label>

                  {/* Input with Steppers */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={isPending || quantity <= 1}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl border-border bg-white hover:bg-slate-50 text-foreground text-base font-bold shrink-0 shadow-2xs cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>

                    <div className="relative flex-1">
                      <Input
                        type="number"
                        min={1}
                        max={!isUnlimited && isSold && currentQty > 0 ? currentQty : undefined}
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                        disabled={isPending}
                        className={`h-10 sm:h-11 text-center text-lg sm:text-xl font-black font-mono rounded-xl sm:rounded-2xl bg-slate-50 border-border text-foreground focus-visible:ring-2 ${
                          isSold
                            ? 'focus-visible:ring-red-500 border-red-200'
                            : 'focus-visible:ring-emerald-500 border-emerald-200'
                        }`}
                      />
                      {!isUnlimited && isSold && currentQty > 0 && quantity === currentQty && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                          MAX
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={isPending || (!isUnlimited && isSold && quantity >= currentQty)}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl border-border bg-white hover:bg-slate-50 text-foreground text-base font-bold shrink-0 shadow-2xs cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Smart Quick Increment Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">
                      Quick:
                    </span>
                    {(isUnlimited ? [1, 2, 5, 10, 25, 50, 100] : [1, 2, 5, 10]).map((step) => {
                      const isDisabled = !isUnlimited && isSold && currentQty > 0 && step > currentQty;
                      const isSelected = quantity === step;

                      return (
                        <button
                          key={step}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleQuantityChange(step)}
                          className={`px-2.5 sm:px-3 py-1 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                            isSelected
                              ? isSold
                                ? 'bg-red-600 border-red-600 text-white shadow-2xs'
                                : 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                              : isDisabled
                              ? 'opacity-30 bg-slate-100 border-border text-slate-400 cursor-not-allowed'
                              : 'bg-white border-border/80 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          +{step}
                        </button>
                      );
                    })}

                    {/* "All Stock" Chip for Quick Total Sale on numeric items */}
                    {!isUnlimited && isSold && currentQty > 0 && (
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(currentQty)}
                        className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-black transition-all cursor-pointer ${
                          quantity === currentQty
                            ? 'bg-red-600 border-red-600 text-white shadow-2xs'
                            : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        All ({currentQty})
                      </button>
                    )}
                  </div>
                </div>

                {/* Calculation Summary Bar */}
                <div
                  className={`p-2.5 sm:p-3 rounded-xl border text-xs flex items-center justify-between ${
                    isSold
                      ? 'bg-red-50/70 border-red-200/90 text-red-950'
                      : 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
                  }`}
                >
                  <span className="font-medium text-slate-600">Stock Preview:</span>
                  <span className="font-mono font-bold text-xs sm:text-sm">
                    {isUnlimited ? (
                      <span>
                        {isSold ? `Record Sale of −${quantity} Units` : `Add +${quantity} Units to Stock`}
                      </span>
                    ) : (
                      <span>
                        {currentQty} {isSold ? '−' : '+'} {quantity} ={' '}
                        <strong
                          className={`font-black ${
                            isSold && calculatedNext === 0 ? 'text-red-600' : 'text-foreground'
                          }`}
                        >
                          {calculatedNext} units
                        </strong>
                      </span>
                    )}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <Button
                    type="button"
                    onClick={handleProceedToWarning}
                    disabled={isPending || quantity <= 0 || (!isUnlimited && isSold && currentQty === 0)}
                    className={`w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider text-white shadow-md transition-all cursor-pointer ${
                      isSold
                        ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/25'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4 mr-1 shrink-0" />
                    {isSold
                      ? `Review & Record Sale (−${quantity} Units)`
                      : `Review & Record Purchase (+${quantity} Units)`}
                  </Button>

                  {/* Mark as Sold Out Slide Launcher */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setView('SLIDE_SOLD_OUT')}
                    disabled={isPending || (isOutOfStock && !isUnlimited)}
                    className="w-full h-9 sm:h-10 rounded-xl sm:rounded-2xl border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 text-xs font-bold gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Flame className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    Directly Set to Out of Stock (Slide to Confirm)
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}


