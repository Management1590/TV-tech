'use client';

import React, { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { UserPlus, Mail, Lock, User, Eye, EyeOff, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createStaffAccountAction } from '@/features/auth/actions/auth.actions';
import { toast } from 'sonner';
import {
  useKeyboardViewport,
  useScrollLock,
  handleProximityTouch,
  createPersistentBlurHandler,
} from '@/lib/use-keyboard-viewport';

interface CreateStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStaffDialog({ open, onOpenChange }: CreateStaffDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when modal is open
  useScrollLock(open);

  // Dock to virtual keyboard viewport
  const { containerStyle, isKeyboardOpen } = useKeyboardViewport(open);

  // Persistent blur handler to prevent keyboard from dismissing when tapping inside
  const persistentBlur = useMemo(
    () => createPersistentBlurHandler(open, isPending),
    [open, isPending]
  );

  // Auto-focus the first field (Full Name) when opened
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus({ preventScroll: true });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError(null);
  };

  const handleClose = () => {
    if (isPending) return;
    // Blur ALL inputs immediately so persistentBlur cannot refocus during exit animation
    [nameInputRef, emailInputRef, passwordInputRef].forEach((ref) => {
      if (ref.current) ref.current.blur();
    });
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onOpenChange(false);
    setTimeout(() => {
      resetForm();
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter the staff member\'s full name.');
      nameInputRef.current?.focus();
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      emailInputRef.current?.focus();
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      passwordInputRef.current?.focus();
      return;
    }

    startTransition(async () => {
      const result = await createStaffAccountAction({
        fullName: fullName.trim(),
        email: email.trim(),
        password: password.trim(),
      });

      if (result.success) {
        toast.success(`Staff account created for ${result.user?.fullName || fullName}`);
        resetForm();
        onOpenChange(false);
      } else {
        setError(result.error || 'Failed to create staff account.');
      }
    });
  };

  return (
    <>
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                className="fixed inset-x-0 z-[110] flex flex-col justify-end items-center select-none"
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
                  transition={{ duration: 0.2 }}
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
                    maxHeight: isKeyboardOpen ? 'calc(100% + 380px)' : '92dvh',
                    paddingBottom: isKeyboardOpen ? '380px' : undefined,
                    marginBottom: isKeyboardOpen ? '-380px' : undefined,
                  }}
                  className="relative z-10 w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col overflow-hidden will-change-transform transform-gpu select-text"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => handleProximityTouch(e, sheetRef.current)}
                >
                  {/* iOS Drag Handle */}
                  <div
                    onPointerDown={(e) => dragControls.start(e)}
                    className="pt-2.5 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none"
                  >
                    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                  </div>

                  {/* Header */}
                  <div
                    onPointerDown={(e) => {
                      const target = e.target as HTMLElement | null;
                      if (target?.closest('button') || target?.closest('input')) return;
                      dragControls.start(e);
                    }}
                    className="px-5 sm:px-6 pt-1 pb-2.5 border-b border-border/60 flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border border-indigo-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                          Create Staff Account
                        </h2>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1">
                          Provision login credentials for a new TV Technician
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isPending}
                      className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Non-Scrollable Form Content (Fits cleanly on all screens) */}
                  <form onSubmit={handleSubmit} className="flex flex-col shrink-0">
                    <div className="px-5 sm:px-6 py-3 space-y-2.5">
                      {error && (
                        <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold animate-in fade-in leading-tight">
                          {error}
                        </div>
                      )}

                      {/* 1. Full Name */}
                      <div className="space-y-1">
                        <Label htmlFor="staff-name" className="text-[11px] font-bold text-foreground">
                          Full Name *
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <Input
                            ref={nameInputRef}
                            id="staff-name"
                            type="text"
                            placeholder="e.g. Ramesh Kumar"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            onBlur={persistentBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                emailInputRef.current?.focus();
                              }
                            }}
                            className="pl-8.5 h-9 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border-border/80 text-foreground text-xs placeholder:text-muted-foreground/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/30 font-medium"
                            required
                            autoFocus
                            disabled={isPending}
                          />
                        </div>
                      </div>

                      {/* 2. Staff Email Address */}
                      <div className="space-y-1">
                        <Label htmlFor="staff-email" className="text-[11px] font-bold text-foreground">
                          Staff Email Address *
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" />
                          </div>
                          <Input
                            ref={emailInputRef}
                            id="staff-email"
                            type="email"
                            placeholder="ramesh@modernelectronics.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={persistentBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                passwordInputRef.current?.focus();
                              }
                            }}
                            className="pl-8.5 h-9 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border-border/80 text-foreground text-xs placeholder:text-muted-foreground/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/30 font-medium"
                            required
                            disabled={isPending}
                          />
                        </div>
                      </div>

                      {/* 3. Password */}
                      <div className="space-y-1">
                        <Label htmlFor="staff-password" className="text-[11px] font-bold text-foreground">
                          Password (min. 6 characters) *
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <Input
                            ref={passwordInputRef}
                            id="staff-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={persistentBlur}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSubmit(e as any);
                              }
                            }}
                            className="pl-8.5 pr-9 h-9 rounded-xl bg-muted/40 hover:bg-white focus:bg-white border-border/80 text-foreground text-xs placeholder:text-muted-foreground/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/30 font-medium"
                            required
                            disabled={isPending}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Access Permission Info Note */}
                      <div className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border/70 flex items-center gap-2 text-[10px] text-muted-foreground leading-tight">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Technician access for Knowledge Base and Inventory.</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div
                      className={`px-5 sm:px-6 pt-2.5 border-t border-border/60 bg-white dark:bg-slate-900 flex items-center justify-between gap-2.5 shrink-0 ${
                        isKeyboardOpen ? 'pb-2.5' : 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
                      }`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isPending}
                        className="rounded-2xl text-xs h-9 px-4 cursor-pointer font-medium"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending || !fullName.trim() || !email.trim() || !password.trim()}
                        className="rounded-2xl text-xs h-9 px-4.5 font-bold gap-1.5 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all cursor-pointer"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Creating Account...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Create Staff Account</span>
                          </>
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
