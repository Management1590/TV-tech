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
import { IosSlideToConfirm } from '@/components/shared/ios-slide-to-confirm';
import { useScrollLock } from '@/lib/use-keyboard-viewport';

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
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isKbRoute = pathname.startsWith('/knowledge-base');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when mobile profile or sign out sheet is open
  useScrollLock(mobileOpen || isSignOutOpen);

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
    <header
      className="relative z-40 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-xl border-b border-x border-border/70 rounded-b-2xl sm:rounded-b-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.40)] transition-all"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
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

        {/* Middle Area: Command Palette Search for non-KB, or User Full Name & Status for KB */}
        {isKbRoute ? (
          <div className="flex-1 flex items-center justify-start sm:justify-center min-w-0 px-1 sm:px-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-2xl bg-card/90 hover:bg-muted/90 active:bg-muted border border-border/80 text-foreground transition-all duration-200 min-w-0 max-w-full cursor-pointer text-left group shadow-2xs"
              title="View account details & permissions"
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-black text-xs flex items-center justify-center text-white shadow-xs shrink-0 ${
                  isAdmin
                    ? 'bg-gradient-to-tr from-primary to-blue-600'
                    : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
                }`}
              >
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs sm:text-sm font-extrabold text-foreground truncate group-hover:text-primary transition-colors leading-none">
                    {displayName}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" title="Active Session" />
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold mt-0.5 leading-none truncate">
                  {isAdmin ? 'Super Admin' : 'Staff Technician'}
                </span>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex-1 max-w-xl flex justify-center">
            <CommandPalette />
          </div>
        )}

        {/* User Profile & Actions Toolbar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Admin-only: Create New Staff Account Button */}
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateStaffOpen(true)}
              className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 rounded-2xl text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200/80 shadow-2xs transition-all gap-1.5 cursor-pointer shrink-0 flex items-center justify-center"
              title="Create new Staff account"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Add Staff</span>
            </Button>
          )}

          {/* Dedicated Direct Sign Out Button for Knowledge Base Brand Directory */}
          {isKbRoute && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSignOutOpen(true)}
              disabled={isPending}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:text-rose-700 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs transition-all gap-1 sm:gap-1.5 cursor-pointer active:scale-95 shrink-0"
              title="Sign out of TV Tech OS"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              )}
              <span>Sign Out</span>
            </Button>
          )}

          {/* DESKTOP VIEW: Interactive Dropdown Card for non-KB routes */}
          {!isKbRoute && (
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
                    onClick={() => setIsSignOutOpen(true)}
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
          )}

          {/* Mobile Profile Trigger (only for non-KB routes) */}
          {!isKbRoute && (
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
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE / KB PORTAL: iOS Spring Bottom Sheet (Single Page Layout)           */}
      {/* ========================================================================= */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {mobileOpen && (
            <div
              className="fixed inset-x-0 bottom-0 z-[100] flex flex-col justify-end items-center select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
                }
              }}
            >
              {/* Soft Blurred iOS Backdrop Layer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10 will-change-opacity cursor-pointer touch-none"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileOpen(false);
                }}
              />

              {/* iOS Style Bottom Sheet Page */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{
                  y: '100%',
                  transition: {
                    duration: 0.22,
                    ease: [0.32, 0, 0.67, 0],
                  },
                }}
                transition={{
                  type: 'spring',
                  damping: 30,
                  stiffness: 340,
                  mass: 0.8,
                }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.2 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 320) {
                    setMobileOpen(false);
                  }
                }}
                className="relative z-10 w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-t-[36px] border-t border-border/70 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden will-change-transform transform-gpu"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Drag Indicator Handle */}
                <div className="pt-3 pb-1 flex justify-center w-full cursor-grab active:cursor-grabbing shrink-0 touch-none">
                  <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/40 transition-colors" />
                </div>

                {/* Compact Native Sheet Header */}
                <div className="px-5 sm:px-6 pt-1 pb-3 border-b border-border/60 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground leading-tight truncate">
                        User Account
                      </h2>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Profile credentials & system session
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Single Page Scrollable Sheet Body */}
                <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar flex flex-col items-center w-full">
                  {/* Profile Card Showcase */}
                  <div className="w-full bg-gradient-to-b from-muted/50 via-muted/30 to-muted/10 dark:from-slate-800/60 dark:to-slate-900/40 rounded-3xl border border-border/70 p-5 flex flex-col items-center text-center relative overflow-hidden shadow-xs">
                    {/* Top Accent Gradient Line */}
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-blue-600 to-indigo-600" />

                    {/* Ambient Glow */}
                    <div className="absolute top-2 w-28 h-28 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

                    {/* Large Profile Avatar with Glow */}
                    <div className="relative mb-2 mt-1">
                      <div
                        className={`w-16 h-16 rounded-2xl font-black text-xl flex items-center justify-center text-white shadow-xl ring-4 ring-primary/10 ${
                          isAdmin
                            ? 'bg-gradient-to-tr from-primary via-blue-600 to-indigo-600'
                            : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
                        }`}
                      >
                        {initials}
                      </div>
                    </div>

                    {/* FULL NAME - Untruncated */}
                    <h3 className="font-black text-base sm:text-lg text-foreground tracking-tight leading-snug break-words max-w-full">
                      {displayName}
                    </h3>

                    {/* FULL EMAIL */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium mt-1 break-all max-w-full">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="select-text">{userEmail}</span>
                    </div>

                    {/* Role Badge */}
                    <div className="mt-2.5">
                      <Badge
                        variant="secondary"
                        className={`text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${
                          isAdmin
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 mr-1 text-primary" />
                        {isAdmin ? 'Super Administrator' : 'Staff Technician'}
                      </Badge>
                    </div>

                    {/* Live Session & Status Details */}
                    <div className="w-full mt-4 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-border/70 rounded-2xl space-y-2 text-xs text-left shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Session Status</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Active (Live)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Access Tier</span>
                        <span className="font-semibold text-foreground">
                          {isAdmin ? 'Full Administrative' : 'Staff Technician Access'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Group Card */}
                  <div className="w-full bg-muted/40 dark:bg-slate-800/40 rounded-2xl border border-border/60 p-1.5 space-y-1">
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
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-foreground/90 hover:bg-white dark:hover:bg-slate-700/80 active:bg-white dark:active:bg-slate-700 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <UserPlus className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="leading-tight text-foreground font-bold">Create Staff Account</div>
                          <div className="text-[11px] font-normal text-muted-foreground">Add technician credentials</div>
                        </div>
                      </button>
                    )}

                    {/* Sign Out Action */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMobileOpen(false);
                        setIsSignOutOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50/80 dark:hover:bg-red-950/40 active:bg-red-100/80 active:scale-[0.98] rounded-xl transition-all cursor-pointer text-left group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200/80 dark:border-red-900/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight text-red-600 font-bold">Sign Out</div>
                        <div className="text-[11px] font-normal text-red-400">End current session</div>
                      </div>
                    </button>
                  </div>

                  {/* Cancel Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMobileOpen(false)}
                    className="w-full h-11 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/70 border border-border/70 transition-all cursor-pointer mt-1 active:scale-[0.99]"
                  >
                    Cancel
                  </Button>
                </div>

                {/* Safe Area Spacer */}
                <div className="pb-[calc(1rem+env(safe-area-inset-bottom,0px))]" />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* iOS Slide to Confirm Sign Out Sheet / Dialog */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isSignOutOpen && (
            <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => !isPending && setIsSignOutOpen(false)}
              />

              {/* Sheet / Modal */}
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
                className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl border border-border/70 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* iOS Drag Handle */}
                <div className="pt-3 pb-1 flex justify-center sm:hidden">
                  <div className="w-10 h-1.5 rounded-full bg-muted-foreground/20" />
                </div>

                {/* Header */}
                <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-3 flex items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-900/40 flex items-center justify-center shrink-0">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-foreground leading-tight">Confirm Sign Out</h2>
                      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">End your active workstation session</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !isPending && setIsSignOutOpen(false)}
                    disabled={isPending}
                    className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* User Details Preview Box */}
                <div className="p-5 sm:p-6 space-y-3.5 flex-1 overflow-y-auto no-scrollbar">
                  <div className="p-3.5 bg-muted/40 border border-border/70 rounded-2xl flex items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl font-black text-lg flex items-center justify-center text-white shrink-0 shadow-md ${
                        isAdmin
                          ? 'bg-gradient-to-tr from-primary via-blue-600 to-indigo-600'
                          : 'bg-gradient-to-tr from-indigo-500 to-indigo-700'
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                        {displayName}
                      </h3>
                      <div className="text-[11px] sm:text-xs text-muted-foreground truncate font-medium">
                        {userEmail}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            isAdmin
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          <Shield className="w-3 h-3 mr-1 text-primary" />
                          {isAdmin ? 'Administrator' : 'Staff Technician'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Notice */}
                  <div className="p-3.5 bg-red-50/60 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/40 rounded-2xl text-xs text-red-900 dark:text-red-300 font-medium leading-relaxed">
                    You are about to sign out of TV Tech OS. You will need to re-authenticate with your email and password to access the technician portal again.
                  </div>
                </div>

                {/* Footer with iOS Slide to Sign Out & Cancel */}
                <div className="px-5 sm:px-6 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/60 bg-white/95 dark:bg-slate-900/95 flex flex-col gap-2.5 shrink-0">
                  <IosSlideToConfirm
                    onConfirm={handleLogout}
                    isLoading={isPending}
                    label="slide to sign out"
                    loadingLabel="Signing Out..."
                    variant="danger"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsSignOutOpen(false)}
                    disabled={isPending}
                    className="w-full h-10 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
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
