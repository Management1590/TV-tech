'use client';

import React, { useState, useTransition } from 'react';
import { UserPlus, Mail, Lock, User, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createStaffAccountAction } from '@/features/auth/actions/auth.actions';
import { toast } from 'sonner';

interface CreateStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStaffDialog({ open, onOpenChange }: CreateStaffDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter the staff member\'s full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters long.');
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
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isPending) {
          if (!val) resetForm();
          onOpenChange(val);
        }
      }}
    >
      <DialogContent className="sm:max-w-[440px] p-6 bg-white/95 backdrop-blur-xl border border-border/80 text-foreground rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-2 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-2xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Create Staff Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Provision login credentials for a new TV Technician.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 animate-in fade-in">
              {error}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="staff-name" className="text-xs font-bold text-foreground">
              Full Name
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <User className="w-4 h-4" />
              </div>
              <Input
                id="staff-name"
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-slate-50/70 border-border text-foreground text-xs placeholder:text-muted-foreground/60 focus-visible:ring-primary"
                required
                disabled={isPending}
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <Label htmlFor="staff-email" className="text-xs font-bold text-foreground">
              Staff Email Address
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Mail className="w-4 h-4" />
              </div>
              <Input
                id="staff-email"
                type="email"
                placeholder="ramesh@modernelectronics.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-slate-50/70 border-border text-foreground text-xs placeholder:text-muted-foreground/60 focus-visible:ring-primary"
                required
                disabled={isPending}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="staff-password" className="text-xs font-bold text-foreground">
              Password
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="staff-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-10 h-10 rounded-xl bg-slate-50/70 border-border text-foreground text-xs placeholder:text-muted-foreground/60 focus-visible:ring-primary"
                required
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Access info note */}
          <div className="p-3 rounded-xl bg-slate-50/90 border border-border/70 flex items-start gap-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Staff account will be stored in Supabase with standard technician permissions for the Knowledge Base and Inventory.
            </span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs rounded-xl h-9 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl h-9 px-4 shadow-sm shadow-primary/20 gap-1.5 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Create Staff Account
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
