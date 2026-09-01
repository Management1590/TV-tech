'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Tv,
  ArrowLeft,
  LogOut,
  Loader2,
  Sparkles,
  UserPlus,
  User,
  Mail,
  Shield,
  ChevronDown,
  X,
  CheckCircle2,
} from 'lucide-react';
import { AppLogo } from '@/components/shared/app-logo';
import { CommandPalette } from '@/components/shared/command-palette';
import { logoutAction } from '@/features/auth/actions/auth.actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateStaffDialog } from '@/components/auth/create-staff-dialog';

interface HeaderProps {
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isPending, startTransition] = useTransition();
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isKbRoute = pathname.startsWith('/knowledge-base');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile profile sheet is active
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  const isAdmin = user?.role === 'ADMIN';
  const isRootPage = pathname === '/' || pathname === '/inventory';
  const isItemPage = pathname.startsWith('/inventory/items/');
  const isFolderSubpage = pathname.startsWith('/inventory/folders/');
  const shouldShowBackButton = isItemPage || isFolderSubpage || !isRootPage;

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(isAdmin ? '/inventory' : '/inventory');
    }
  };

  const displayName = user?.fullName || (isAdmin ? 'Modern Electronics Admin' : 'Staff Technician');
  const userEmail = user?.email || (isAdmin ? 'admin@modernelectronics.com' : 'staff@modernelectronics.com');
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || (isAdmin ? 'ME' : 'ST');

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  const isBrandDirectory = pathname === '/knowledge-base';
  const isKbSubroute = pathname.startsWith('/knowledge-base') && !isBrandDirectory;

  // Top bar is strictly visible in Brand Directory (/knowledge-base) and hidden in model folder, technical folder, and anywhere else in Knowledge Base
  if (isKbSubroute) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/70 shadow-2xs transition-all" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Top-Left Back Button / Logo Branding */}
        {shouldShowBackButton ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go Back"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary/10 to-primary/10 border border-primary/25 hover:border-primary/50 flex items-center justify-center text-primary shadow-2xs hover:bg-primary/15 active:scale-90 transition-all duration-200 cursor-pointer shrink-0 group"
              title="Go back (restores scroll position)"
            >
              <ArrowLeft className="w-5 h-5 text-primary stroke-[2.5] group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="hidden md:flex flex-col">
              <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base tracking-tight text-foreground leading-none">
                <span>MODERN</span>
                <span className="text-primary font-black">ELECTRONICS</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase mt-0.5">
                Back to previous
              </span>
            </div>
          </div>
        ) : isKbRoute ? (
          <div className="flex items-center gap-2.5 shrink-0 select-none cursor-default">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary/15 to-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs">
              <AppLogo className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base tracking-tight text-foreground leading-none">
                <span>MODERN</span>
                <span className="text-primary font-black">ELECTRONICS</span>
              </div>
              <span className="text-[10px] font-bold text-primary tracking-wider uppercase mt-0.5">
                Knowledge Base
              </span>
            </div>
          </div>
        ) : (
          <Link href={isAdmin ? '/' : '/inventory'} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary/15 to-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs group-hover:scale-105 group-hover:shadow-md group-hover:border-primary/40 transition-all duration-200">
              <AppLogo className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5 font-extrabold text-sm sm:text-base tracking-tight text-foreground leading-none">
                <span>MODERN</span>
                <span className="text-primary font-black">ELECTRONICS</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase mt-0.5">
                Operating System
              </span>
            </div>
          </Link>
        )}

        {/* Command Palette Search */}
        <div className="flex-1 max-w-xl flex justify-center">
          <CommandPalette />
        </div>

        {/* User Profile & Actions Toolbar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Admin-only: Create New Staff Account Button */}
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateStaffOpen(true)}
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-2xl text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200/80 shadow-2xs transition-all gap-1.5 cursor-pointer"
              title="Create new Staff account"
            >
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Add Staff</span>
            </Button>
          )}

          {/* ========================================================================= */}
          {/* DESKTOP VIEW: Interactive Dropdown Card                                    */}
          {/* ========================================================================= */}
          <div className="hidden sm:block">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-muted/90 hover:bg-muted/80 border border-border/80 text-foreground transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group"
                aria-label="User profile menu"
              >
                <div
                  className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center text-white shadow-2xs ${
                    isAdmin
                      ? 'bg-gradient-to-tr from-primary to-blue-600'
                      : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
                  }`}
                >
                  {initials}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-foreground leading-none group-hover:text-primary transition-colors">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {isAdmin ? 'Super Admin' : 'Staff Technician'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform group-data-[state=open]:rotate-180 ml-0.5" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-80 rounded-3xl bg-card border border-border shadow-2xl p-4 z-50"
              >
                {/* Profile Header Card */}
                <div className="flex items-start gap-3 pb-3 border-b border-border/70">
                  <div
                    className={`w-12 h-12 rounded-2xl font-black text-sm flex items-center justify-center text-white shadow-md shrink-0 ${
                      isAdmin
                        ? 'bg-gradient-to-tr from-primary via-blue-600 to-indigo-600'
                        : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
                    }`}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm text-foreground break-words leading-tight">
                      {displayName}
                    </h3>

                    {/* User Email */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mt-1 break-all">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{userEmail}</span>
                    </div>

                    {/* Role Badge */}
                    <div className="mt-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isAdmin
                            ? 'bg-primary/5 text-primary border-primary/20'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {isAdmin ? 'Super Admin' : 'Staff Technician'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Account Status */}
                <div className="py-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground px-1">
                    <span className="text-[11px] font-medium">Session Status</span>
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active (Live)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground px-1">
                    <span className="text-[11px] font-medium">Permissions</span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {isAdmin ? 'Full System Privileges' : 'Inventory & Repairs'}
                    </span>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1 border-border/70" />

                {/* Admin Quick Action: Add Staff */}
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => setIsCreateStaffOpen(true)}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl cursor-pointer hover:bg-muted text-foreground"
                  >
                    <UserPlus className="w-4 h-4 text-indigo-600" />
                    <span>Create Staff Account</span>
                  </DropdownMenuItem>
                )}

                {/* Sign Out Action */}
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={isPending}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-bold rounded-xl cursor-pointer text-red-600 hover:bg-red-50/80 focus:bg-red-50/80 focus:text-red-600"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                  ) : (
                    <LogOut className="w-4 h-4 text-red-600" />
                  )}
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ========================================================================= */}
          {/* MOBILE VIEW: Touch Trigger Pill                                           */}
          {/* ========================================================================= */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open profile details"
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-2xl bg-muted/90 active:bg-muted/80 border border-border/80 text-foreground transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs"
          >
            <div
              className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center text-white shadow-xs ${
                isAdmin
                  ? 'bg-gradient-to-tr from-primary to-blue-600'
                  : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
              }`}
            >
              {initials}
            </div>
          </button>

          <div className="h-6 w-px bg-border/80 hidden sm:block mx-0.5" />

          {/* Desktop Logout Button */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            disabled={isPending}
            className="hidden sm:flex h-10 px-3 sm:px-3.5 rounded-2xl text-xs font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50/80 border border-border/60 hover:border-red-200/80 transition-all duration-200 cursor-pointer gap-2"
            title="Sign out of TV Tech OS"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
            ) : (
              <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-600 transition-colors" />
            )}
            <span>Logout</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE PORTAL OVERLAY: iOS Spring Bottom Slide & Center Card Studio       */}
      {/* ========================================================================= */}
      {mounted && createPortal(
        <AnimatePresence>
          {mobileOpen && (
            <div
              className="fixed inset-0 z-[100] flex flex-col justify-between items-center p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:hidden select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
                }
              }}
            >
              {/* Backdrop Blur Layer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md -z-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
                }}
              />

              {/* Top Pill / Dismiss Button */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full flex items-center justify-between pt-1 px-1 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] font-extrabold tracking-wider uppercase text-white bg-white/20 px-3 py-1 rounded-full border border-white/30 backdrop-blur-md shadow-md">
                  User Account
                </span>
                <button
                  type="button"
                  aria-label="Close profile menu"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/30 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Center: Floating Full Profile Details Card (iOS Spring Pop) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.82, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: 10 }}
                transition={{
                  type: 'spring',
                  damping: 24,
                  stiffness: 340,
                  mass: 0.8,
                }}
                className="relative z-10 w-full max-w-[300px] my-auto py-2 pointer-events-auto filter drop-shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-card rounded-3xl p-5 border border-border shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                  {/* Subtle Top Gradient Accent */}
                  <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-primary" />

                  {/* Large Profile Avatar with Glow */}
                  <div className="relative mb-3 mt-1">
                    <div
                      className={`w-16 h-16 rounded-2xl font-black text-xl flex items-center justify-center text-white shadow-xl ${
                        isAdmin
                          ? 'bg-gradient-to-tr from-primary via-blue-600 to-indigo-600'
                          : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
                      }`}
                    >
                      {initials}
                    </div>
                  </div>

                  {/* FULL NAME - Untruncated */}
                  <h2 className="font-black text-base sm:text-lg text-foreground tracking-tight leading-snug break-words max-w-full px-1">
                    {displayName}
                  </h2>

                  {/* FULL EMAIL - Untruncated */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium mt-1.5 break-all max-w-full px-1">
                    <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="select-text">{userEmail}</span>
                  </div>

                  {/* Role Badge */}
                  <div className="mt-3">
                    <Badge
                      variant="secondary"
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        isAdmin
                          ? 'bg-primary/5 text-primary border-primary/20'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 mr-1 text-primary" />
                      {isAdmin ? 'Super Administrator' : 'Staff Technician'}
                    </Badge>
                  </div>

                  {/* Account Status Info Box */}
                  <div className="w-full mt-4 p-3 bg-muted/50 border border-border rounded-2xl space-y-2 text-xs text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Session</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active (Live)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Access</span>
                      <span className="font-semibold text-foreground">
                        {isAdmin ? 'Full Administrative' : 'Staff Access'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Bottom: Smooth Slide-up Actions Sheet (iOS Spring Slide Up) */}
              <motion.div
                initial={{ opacity: 0, y: 70, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.96 }}
                transition={{
                  type: 'spring',
                  damping: 26,
                  stiffness: 320,
                  mass: 0.85,
                  delay: 0.03,
                }}
                className="relative z-10 w-full max-w-sm flex flex-col gap-2 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Actions Box */}
                <div className="bg-card rounded-3xl p-2 border border-border shadow-2xl flex flex-col gap-1">
                  {/* Admin Option: Add Staff */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsCreateStaffOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground hover:bg-muted/50 active:bg-muted active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-foreground font-bold">Create Staff Account</div>
                        <div className="text-[11px] font-normal text-muted-foreground">Add technician credentials</div>
                      </div>
                    </button>
                  )}

                  {/* Sign Out Action */}
                  <div className={isAdmin ? 'border-t border-border/50 my-0.5 pt-0.5' : ''}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50/80 active:bg-red-100/80 active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50/80 text-red-600 border border-red-200/80 flex items-center justify-center shrink-0">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-red-600 font-bold">Sign Out</div>
                        <div className="text-[11px] font-normal text-red-400">End current session</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Standalone iOS Style Cancel Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileOpen(false);
                  }}
                  className="w-full py-3.5 bg-card text-foreground font-extrabold text-sm rounded-2xl border border-border shadow-lg active:bg-muted active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Admin Create Staff Account Dialog */}
      {isAdmin && (
        <CreateStaffDialog
          open={isCreateStaffOpen}
          onOpenChange={setIsCreateStaffOpen}
        />
      )}
    </header>
  );
};
