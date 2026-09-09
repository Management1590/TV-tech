'use client';

import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, FolderTree, BookOpen, ShoppingBag, BarChart3 } from 'lucide-react';

interface BottomNavProps {
  userRole?: string;
}

// Active elevated circular button gradient & shadow matching the reference design
const ROUTE_THEMES: Record<
  string,
  { gradient: string; shadow: string }
> = {
  '/': {
    gradient: 'linear-gradient(135deg, #ff2a6d 0%, #db0058 100%)',
    shadow: 'rgba(225, 29, 72, 0.45)',
  },
  '/inventory': {
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
    shadow: 'rgba(79, 70, 229, 0.45)',
  },
  '/purchase-manager': {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    shadow: 'rgba(16, 185, 129, 0.45)',
  },
  '/knowledge-base': {
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    shadow: 'rgba(139, 92, 246, 0.45)',
  },
  '/analytics': {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    shadow: 'rgba(245, 158, 11, 0.45)',
  },
};

const DEFAULT_THEME = {
  gradient: 'linear-gradient(135deg, #ff2a6d 0%, #db0058 100%)',
  shadow: 'rgba(225, 29, 72, 0.45)',
};

const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutGrid },
  { label: 'Inventory', href: '/inventory', icon: FolderTree },
  { label: 'Purchases', href: '/purchase-manager', icon: ShoppingBag },
  { label: 'Knowledge', href: '/knowledge-base', icon: BookOpen },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const STAFF_NAV_ITEMS = [
  { label: 'Inventory', href: '/inventory', icon: FolderTree },
  { label: 'Knowledge', href: '/knowledge-base', icon: BookOpen },
];

export const BottomNav: React.FC<BottomNavProps> = ({ userRole = 'STAFF' }) => {
  const pathname = usePathname();

  // Route visibility rules:
  // 1. Dashboard: '/' (fixed)
  // 2. Analytics: '/analytics' (fixed)
  // 3. Purchase Manager: '/purchase-manager' (fixed)
  // 4. Inventory: ONLY root directory '/inventory' (hidden in folders, items, and subdirectories)
  // 5. Knowledge Base: ONLY root directory '/knowledge-base' (hidden in brands, models, folders, etc.)
  const isDashboard = pathname === '/';
  const isAnalytics = pathname === '/analytics' || pathname.startsWith('/analytics/');
  const isPurchaseManager = pathname === '/purchase-manager' || pathname.startsWith('/purchase-manager/');
  const isInventoryRoot = pathname === '/inventory' || pathname === '/inventory/';
  const isKnowledgeBaseRoot = pathname === '/knowledge-base' || pathname === '/knowledge-base/';

  const shouldShowBottomNav =
    isDashboard ||
    isAnalytics ||
    isPurchaseManager ||
    isInventoryRoot ||
    isKnowledgeBaseRoot;

  if (!shouldShowBottomNav) return null;

  const isAdmin = userRole === 'ADMIN';
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : STAFF_NAV_ITEMS;

  return <NavBar navItems={navItems} pathname={pathname} />;
};

function NavBar({
  navItems,
  pathname,
}: {
  navItems: { label: string; href: string; icon: any }[];
  pathname: string;
}) {
  const router = useRouter();
  const maskId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(364);

  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = navItems.findIndex(
      (item) =>
        pathname === item.href ||
        (item.href !== '/' && pathname.startsWith(item.href))
    );
    return idx >= 0 ? idx : 0;
  });

  // Hold & Slide Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  useEffect(() => {
    const idx = navItems.findIndex(
      (item) =>
        pathname === item.href ||
        (item.href !== '/' && pathname.startsWith(item.href))
    );
    if (idx !== -1) setActiveIdx(idx);
  }, [pathname, navItems]);

  // Prefetch tabs for instant navigation upon release
  useEffect(() => {
    navItems.forEach((item) => {
      try {
        router.prefetch(item.href);
      } catch {
        // Safe fallback
      }
    });
  }, [navItems, router]);

  // Responsive width tracking
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        if (w > 0) setBarWidth(w);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const tabCount = navItems.length;
  const tabWidth = barWidth / (tabCount || 1);
  const restingActiveX = (activeIdx + 0.5) * tabWidth;
  const currentX = isDragging && dragX !== null ? dragX : restingActiveX;

  const activeItem = navItems[activeIdx] ?? navItems[0];
  const activeTheme = ROUTE_THEMES[activeItem?.href] ?? DEFAULT_THEME;
  const ActiveIcon = activeItem?.icon;

  const getRelativeX = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return restingActiveX;
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const minX = tabWidth * 0.5;
      const maxX = barWidth - tabWidth * 0.5;
      return Math.max(minX, Math.min(maxX, rawX));
    },
    [barWidth, tabWidth, restingActiveX]
  );

  const getTabIndexFromX = useCallback(
    (x: number) => {
      const idx = Math.floor(x / tabWidth);
      return Math.max(0, Math.min(tabCount - 1, idx));
    },
    [tabWidth, tabCount]
  );

  const navigateToTab = useCallback(
    (idx: number) => {
      const targetItem = navItems[idx];
      if (!targetItem) return;
      setActiveIdx(idx);
      if (pathname !== targetItem.href) {
        router.push(targetItem.href);
      }
    },
    [navItems, pathname, router]
  );

  // Pointer event handlers for hold-and-slide
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click or touch only
    const relX = getRelativeX(e.clientX);
    const targetIdx = getTabIndexFromX(relX);

    startPosRef.current = { x: e.clientX, y: e.clientY, moved: false };
    setIsDragging(true);
    setDragX(relX);

    if (targetIdx !== activeIdxRef.current) {
      setActiveIdx(targetIdx);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 4 || dy > 4) {
      startPosRef.current.moved = true;
    }

    const relX = getRelativeX(e.clientX);
    setDragX(relX);

    const targetIdx = getTabIndexFromX(relX);
    if (targetIdx !== activeIdxRef.current) {
      setActiveIdx(targetIdx);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(6);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const relX = getRelativeX(e.clientX);
    const finalIdx = getTabIndexFromX(relX);

    setIsDragging(false);
    setDragX(null);
    navigateToTab(finalIdx);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    setIsDragging(false);
    setDragX(null);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center items-end px-2.5 select-none pointer-events-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2px)' }}
    >
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative w-full max-w-[364px] h-[64px] pointer-events-auto touch-none select-none cursor-grab active:cursor-grabbing"
      >
        {/* SVG Container with Mask for Notch Curve */}
        <svg
          width={barWidth}
          height={64}
          viewBox={`0 0 ${barWidth} 64`}
          className="absolute inset-0 overflow-visible drop-shadow-[0_10px_24px_rgba(0,0,0,0.10)] dark:drop-shadow-[0_12px_28px_rgba(0,0,0,0.50)]"
        >
          <defs>
            <mask id={maskId}>
              {/* White fills everything (solid/visible) */}
              <rect x="0" y="0" width={barWidth} height="64" fill="white" />
              {/* Sliding Notch Cutout */}
              <g
                style={{
                  transform: `translateX(${currentX}px)`,
                  transition: isDragging
                    ? 'transform 0.04s linear'
                    : 'transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1)',
                }}
              >
                {/* Organic smooth scoop: bar top is at y=14, dips to y=39 with gentle shoulders */}
                <path
                  d="M -35 14 
                     C -22 14, -20 39, 0 39 
                     C 20 39, 22 14, 35 14 
                     Z"
                  fill="black"
                />
              </g>
            </mask>
          </defs>

          {/* White in light mode, zinc-900 in dark mode */}
          <rect
            x="0"
            y="14"
            width={barWidth}
            height="48"
            rx="24"
            ry="24"
            className="fill-white dark:fill-zinc-900"
            mask={`url(#${maskId})`}
          />
        </svg>

        {/* Floating Active Button (elevated, sliding with activeX) */}
        <div
          className="absolute top-0 left-0 flex items-center justify-center pointer-events-none z-10"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: activeTheme.gradient,
            boxShadow: isDragging
              ? `0 14px 28px -2px ${activeTheme.shadow}`
              : `0 8px 20px -2px ${activeTheme.shadow}`,
            transform: `translateX(${currentX - 21}px) translateY(${isDragging ? '0px' : '3px'}) scale(${isDragging ? 1.08 : 1})`,
            transition: isDragging
              ? 'transform 0.04s linear, background 0.25s ease, box-shadow 0.25s ease'
              : 'transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1), background 0.35s ease, box-shadow 0.35s ease',
          }}
        >
          {ActiveIcon && (
            <ActiveIcon
              key={activeItem.href}
              className={`w-5 h-5 text-white transition-transform duration-200 ${
                isDragging ? 'scale-115' : 'scale-105'
              }`}
              strokeWidth={2.2}
            />
          )}
        </div>

        {/* Clickable Tab Targets */}
        <div className="absolute inset-x-0 bottom-0 flex items-center h-[48px] z-20">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIdx;

            return (
              <Link
                key={item.href}
                href={item.href}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToTab(idx);
                }}
                className="flex-1 flex flex-col items-center justify-center h-full active:scale-90 transition-transform duration-150 outline-none select-none"
                aria-label={item.label}
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-all duration-200 ${
                    isActive
                      ? 'opacity-0 scale-75'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 scale-100 opacity-100'
                  }`}
                  strokeWidth={1.85}
                />
              </Link>
            );
          })}
        </div>

        {/* Subtle iOS Home indicator line at bottom */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-zinc-300/80 dark:bg-zinc-700/80 rounded-full pointer-events-none" />
      </div>
    </nav>
  );
}
