'use client';

import React, { useState, useTransition, useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Monitor, Loader2, Plus, Sparkles, CheckCircle2, Tv, AlertTriangle, AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { createTvModelAction } from '@/features/knowledge-base/actions/kb.actions';
import { validateNameSimilarity } from '@/features/knowledge-base/utils/name-similarity-validator';
import {
  useKeyboardViewport,
  handleProximityTouch,
  createPersistentBlurHandler,
} from '@/lib/use-keyboard-viewport';

interface CreateTvModelDialogProps {
  brands: { id: string; name: string }[];
  preselectedBrandId?: string;
  initialModelNumber?: string;
  trigger?: React.ReactNode;
  existingModels?: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTvModelDialog({
  brands,
  preselectedBrandId,
  initialModelNumber = '',
  trigger,
  existingModels = [],
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: CreateTvModelDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { containerStyle, isKeyboardOpen } = useKeyboardViewport(open);
  const sheetRef = useRef<HTMLDivElement>(null);

  const [isPending, startTransition] = useTransition();

  const persistentBlur = useMemo(
    () => createPersistentBlurHandler(open, isPending),
    [open, isPending]
  );

  const [brandId, setBrandId] = useState(preselectedBrandId || brands[0]?.id || '');
  const [modelNumber, setModelNumber] = useState(initialModelNumber);
  const [screenSize, setScreenSize] = useState('');
  const [autoDetectedSize, setAutoDetectedSize] = useState<string | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const lastFocusTimeRef = useRef<number>(0);
  const dragControls = useDragControls();

  // Smooth focus on model input when opening dialog
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (modelInputRef.current) {
          modelInputRef.current.focus({ preventScroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = () => {
    if (isPending) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setOpen(false);
    setTimeout(() => {
      setModelNumber('');
      setScreenSize('');
      setAutoDetectedSize(null);
    }, 250);
  };

  // Sync initialModelNumber when dialog opens
  useEffect(() => {
    if (open) {
      if (initialModelNumber) {
        const upper = initialModelNumber.toUpperCase();
        setModelNumber(upper);
        const cleaned = upper.trim();
        const match = cleaned.match(/^(\d{2})/) || cleaned.match(/(?:^[A-Z]{0,4}[-_]?)(\d{2})/);
        if (match && match[1]) {
          setScreenSize(match[1]);
          setAutoDetectedSize(match[1]);
        }
      }
    }
  }, [open, initialModelNumber]);

  // Preserve cursor position at the very end when refocusing or returning from other applications
  useEffect(() => {
    if (!open) return;
    const handleAppResume = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          if (modelInputRef.current) {
            const input = modelInputRef.current;
            const len = input.value.length;
            input.focus({ preventScroll: true });
            input.setSelectionRange(len, len);
          }
        }, 120);
      }
    };

    document.addEventListener('visibilitychange', handleAppResume);
    window.addEventListener('focus', handleAppResume);
    return () => {
      document.removeEventListener('visibilitychange', handleAppResume);
      window.removeEventListener('focus', handleAppResume);
    };
  }, [open]);



  // Real-time duplicate & similarity checking
  const similarityResult = useMemo(() => {
    if (!modelNumber.trim() || !existingModels || existingModels.length === 0) {
      return { level: 'NONE' as const, hasConflict: false, hasWarning: false };
    }
    return validateNameSimilarity(modelNumber, existingModels, 'Model');
  }, [modelNumber, existingModels]);

  // Sync preselectedBrandId if prop changes
  useEffect(() => {
    if (preselectedBrandId) {
      setBrandId(preselectedBrandId);
    } else if (brands.length > 0 && !brandId) {
      setBrandId(brands[0].id);
    }
  }, [preselectedBrandId, brands, brandId]);

  // Selected brand object
  const selectedBrand = brands.find((b) => b.id === brandId);

  // Auto-detect starting 2 numeric digits for screen size and always convert to capital letters
  const handleModelNumberChange = (value: string) => {
    const upper = value.toUpperCase();
    setModelNumber(upper);

    const cleaned = upper.trim();
    const match = cleaned.match(/^(\d{2})/) || cleaned.match(/(?:^[A-Z]{0,4}[-_]?)(\d{2})/);

    if (match && match[1]) {
      const detected = match[1];
      setScreenSize(detected);
      setAutoDetectedSize(detected);
    } else if (!cleaned) {
      setScreenSize('');
      setAutoDetectedSize(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !modelNumber.trim() || similarityResult.level === 'BLOCK') return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    startTransition(async () => {
      const result = await createTvModelAction({
        brandId,
        modelNumber: modelNumber.trim().toUpperCase(),
        screenSize: screenSize.trim() || undefined,
      });

      if (result.success && result.data) {
        if (similarityResult.level === 'WARN_11') {
          toast.warning(`Model "${modelNumber.trim().toUpperCase()}" created (11+ Match: ${similarityResult.conflictingName})`);
        } else if (similarityResult.level === 'WARN_8') {
          toast.warning(`Model "${modelNumber.trim().toUpperCase()}" created (8+ Match: ${similarityResult.conflictingName})`);
        } else if (similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN') {
          toast.success(`Model "${modelNumber.trim().toUpperCase()}" created (Similar to: ${similarityResult.conflictingName})`);
        } else {
          toast.success(`Model "${modelNumber.trim().toUpperCase()}" created successfully`);
        }
        setOpen(false);
        setModelNumber('');
        setScreenSize('');
        setAutoDetectedSize(null);
        router.push(`/knowledge-base/models/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to create model');
      }
    });
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer group shrink-0"
        >
          <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Add Model</span>
        </Button>
      )}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                className="fixed inset-x-0 z-[100] flex flex-col justify-end items-center select-none"
                style={containerStyle}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isPending) {
                    handleClose();
                  }
                }}
              >
                {/* Backdrop Blur Layer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 cursor-pointer touch-none"
                  onClick={() => {
                    if (!isPending) handleClose();
                  }}
                />

                {/* iOS Bottom Sheet */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%', transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
                  transition={{
                    type: 'spring',
                    damping: 30,
                    stiffness: 340,
                    mass: 0.8,
                  }}
                  drag="y"
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.2 }}
                  onDragEnd={(_, info) => {
                    if ((info.offset.y > 80 || info.velocity.y > 320) && !isPending) {
                      handleClose();
                    }
                  }}
                  ref={sheetRef}
                  style={{
                    maxHeight: '100%',
                    paddingBottom: isKeyboardOpen ? '380px' : undefined,
                    marginBottom: isKeyboardOpen ? '-380px' : undefined,
                  }}
                  className="relative z-10 w-full max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => handleProximityTouch(e, sheetRef.current)}
                >
                  {/* Drag Handle */}
                  <div
                    onPointerDown={(e) => dragControls.start(e)}
                    className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
                  >
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div
                    onPointerDown={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest('button') || target?.closest('a') || target?.closest('input')) return;
                      dragControls.start(e);
                    }}
                    className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                          Add TV Model
                        </h2>
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                          {selectedBrand ? (
                            <span>Adding under brand <strong className="text-foreground font-semibold">{selectedBrand.name}</strong></span>
                          ) : (
                            <span>Register a new TV model number</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isPending}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div data-modal-scrollable="true" className="overflow-y-auto px-5 sm:px-6 py-4 space-y-3.5 no-scrollbar flex-1">
                      {/* Optional Brand Selector (Only if multiple brands exist and not preselected) */}
                      {!preselectedBrandId && brands.length > 1 && (
                        <div className="space-y-1">
                          <Label htmlFor="brand-select" className="text-xs font-semibold text-foreground">
                            Brand Category *
                          </Label>
                          <Select value={brandId} onValueChange={(v) => v && setBrandId(v)}>
                            <SelectTrigger id="brand-select" className="h-9.5 rounded-xl bg-muted/40 border-border/80 text-xs font-medium">
                              <SelectValue placeholder="Select brand..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-white border border-border shadow-xl">
                              {brands.map((b) => (
                                <SelectItem key={b.id} value={b.id} className="cursor-pointer font-medium text-xs">
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* 1. Model Number Input */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="model-number" className="text-xs font-semibold text-foreground">
                            Model Number *
                          </Label>
                          {autoDetectedSize && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-2.5 h-2.5" /> {autoDetectedSize}&quot; Size
                            </span>
                          )}
                        </div>
                        <Input
                          ref={modelInputRef}
                          id="model-number"
                          value={modelNumber}
                          onChange={(e) => handleModelNumberChange(e.target.value)}
                          onBlur={persistentBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const sizeInput = document.getElementById('screen-size');
                              if (sizeInput) {
                                sizeInput.focus();
                              }
                            }
                          }}
                          onFocus={(e) => {
                            const len = e.target.value.length;
                            requestAnimationFrame(() => {
                              e.target.setSelectionRange(len, len);
                            });
                          }}
                          placeholder="e.g. 55NU7100, 32LM563, OLED65C1"
                          required
                          autoFocus
                          disabled={isPending}
                          className={`h-10 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border text-sm font-bold uppercase font-mono tracking-wider transition-all focus-visible:ring-2 ${
                            similarityResult.level === 'BLOCK'
                              ? 'border-rose-400 focus-visible:ring-rose-400/40 text-rose-900 bg-rose-50/40'
                              : similarityResult.level === 'WARN_11'
                              ? 'border-2 border-red-600 focus-visible:ring-red-600/50 text-red-950 bg-red-100/40 font-black'
                              : similarityResult.level === 'WARN_8'
                              ? 'border-red-500 focus-visible:ring-red-500/30 text-red-900 bg-red-50/30'
                              : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN'
                              ? 'border-amber-400 focus-visible:ring-amber-400/40 text-foreground bg-amber-50/20'
                              : 'border-border/80 focus-visible:ring-primary/30'
                          }`}
                        />
                        
                        {/* Exact Duplicate Match Restriction Banner */}
                        {similarityResult.level === 'BLOCK' && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="font-bold text-rose-900 text-xs">Exact Duplicate Model</p>
                              <p className="text-[11px] text-rose-700 leading-tight">{similarityResult.message}</p>
                            </div>
                          </div>
                        )}

                        {/* 11+ Match Critical Warning Banner */}
                        {similarityResult.level === 'WARN_11' && (
                          <div className="p-2.5 rounded-xl bg-red-600/10 border-2 border-red-600 text-red-950 text-xs flex items-start gap-2.5 animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 fill-red-600 text-white shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-wider">
                                  11+ Match Warning
                                </span>
                                <span className="font-bold text-xs truncate">&quot;{similarityResult.matchedSequence}&quot;</span>
                              </div>
                              <p className="text-[11px] text-red-900 leading-tight mt-0.5">
                                Matches model <strong className="font-extrabold text-red-950 underline">{similarityResult.conflictingName}</strong>. You may proceed if intended.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 8-10 Match Red Warning Banner */}
                        {similarityResult.level === 'WARN_8' && (
                          <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="font-bold text-red-900 text-xs">
                                8+ Match: &quot;{similarityResult.matchedSequence}&quot;
                              </p>
                              <p className="text-[11px] text-red-800 leading-tight">
                                Matches model <strong className="font-bold text-red-950">{similarityResult.conflictingName}</strong>. You may proceed if intended.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 5-7 Match Soft Amber Warning Banner */}
                        {(similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN') && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="font-bold text-amber-900 text-xs">
                                Similar Model ({similarityResult.matchLength} Chars: &quot;{similarityResult.matchedSequence}&quot;)
                              </p>
                              <p className="text-[11px] text-amber-800 leading-tight">
                                Matches model <strong className="font-semibold text-amber-950">{similarityResult.conflictingName}</strong>.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. TV Screen Size */}
                      <div className="space-y-1">
                        <Label htmlFor="screen-size" className="text-xs font-semibold text-foreground">
                          TV Size (Inches)
                        </Label>
                        <div className="relative flex items-center">
                          <Input
                            id="screen-size"
                            type="number"
                            min="10"
                            max="150"
                            value={screenSize}
                            onChange={(e) => {
                              setScreenSize(e.target.value);
                              setAutoDetectedSize(null);
                            }}
                            onBlur={persistentBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (brandId && modelNumber.trim() && similarityResult.level !== 'BLOCK') {
                                  handleSubmit(e as any);
                                }
                              }
                            }}
                            placeholder="e.g. 55"
                            disabled={isPending}
                            className="h-10 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border-border/80 text-sm font-bold pr-16 transition-all focus-visible:ring-2 focus-visible:ring-primary/30"
                          />
                          <div className="absolute right-3 text-xs font-bold text-muted-foreground pointer-events-none">
                            Inches (&quot;)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div
                      className={`px-5 sm:px-6 pt-2.5 border-t border-border/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 ${
                        isKeyboardOpen ? 'pb-3' : 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isPending}
                        className="rounded-2xl text-xs h-9.5 px-4 cursor-pointer font-medium"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending || !brandId || !modelNumber.trim() || similarityResult.level === 'BLOCK'}
                        className={`rounded-2xl text-xs h-9.5 px-5 font-bold gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
                          similarityResult.level === 'WARN_11'
                            ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800 hover:from-red-600 hover:to-rose-600 shadow-md shadow-red-600/30 border border-red-400/40 font-black text-white'
                            : similarityResult.level === 'WARN_8'
                            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-sm shadow-red-500/20 text-white'
                            : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN'
                            ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 shadow-sm shadow-amber-500/20 text-white'
                            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white shadow-sm shadow-blue-500/20 hover:shadow-md'
                        }`}
                      >
                        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {similarityResult.level === 'WARN_11' ? (
                          <>
                            <span>Proceed & Create (11+ Match)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        ) : similarityResult.level === 'WARN_8' ? (
                          <>
                            <span>Proceed & Create (8+ Match)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        ) : similarityResult.level === 'WARN_5' || similarityResult.level === 'WARN' ? (
                          <>
                            <span>Proceed & Create Model</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <span>Create Model</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
