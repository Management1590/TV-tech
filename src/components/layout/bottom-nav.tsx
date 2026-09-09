'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    // Vibrant Rose/Pink gradient matching reference screenshot
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
  const isItemDetailPage = pathname.startsWith('/inventory/items/');
  if (isItemDetailPage) return null;

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
  const maskId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(380);

  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = navItems.findIndex(
      (item) =>
        pathname === item.href ||
        (item.href !== '/' && pathname.startsWith(item.href))
    );
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    const idx = navItems.findIndex(
      (item) =>
        pathname === item.href ||
        (item.href !== '/' && pathname.startsWith(item.href))
    );
    if (idx !== -1) setActiveIdx(idx);
  }, [pathname, navItems]);

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
  const activeX = (activeIdx + 0.5) * tabWidth;
  const activeItem = navItems[activeIdx] ?? navItems[0];
  const activeTheme = ROUTE_THEMES[activeItem?.href] ?? DEFAULT_THEME;
  const ActiveIcon = activeItem?.icon;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-center items-end px-3 select-none pointer-events-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)' }}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-[390px] h-[88px] pointer-events-auto"
      >
        {/* SVG Container with Mask for Notch Curve */}
        <svg
          width={barWidth}
          height={88}
          viewBox={`0 0 ${barWidth} 88`}
          className="absolute inset-0 overflow-visible drop-shadow-[0_14px_32px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_16px_36px_rgba(0,0,0,0.55)]"
        >
          <defs>
            <mask id={maskId}>
              {/* White fills everything (solid/visible) */}
              <rect x="0" y="0" width={barWidth} height="88" fill="white" />
              {/* Sliding Notch Cutout */}
              <g
                style={{
                  transform: `translateX(${activeX}px)`,
                  transition: 'transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1)',
                }}
              >
                {/* Organic smooth scoop: bar top is at y=22, dips to y=55 with gentle shoulders */}
                <path
                  d="M -44 22 
                     C -28 22, -26 55, 0 55 
                     C 26 55, 28 22, 44 22 
                     Z"
                  fill="black"
                />
              </g>
            </mask>
          </defs>

          {/* White in light mode, zinc-900 in dark mode */}
          <rect
            x="0"
            y="22"
            width={barWidth}
            height="62"
            rx="31"
            ry="31"
            className="fill-white dark:fill-zinc-900"
            mask={`url(#${maskId})`}
          />
        </svg>

        {/* Floating Active Button (elevated, sliding with activeX) */}
        <div
          className="absolute top-0 left-0 flex items-center justify-center cursor-pointer pointer-events-none z-10"
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: activeTheme.gradient,
            boxShadow: `0 12px 26px -2px ${activeTheme.shadow}`,
            transform: `translateX(${activeX - 26}px) translateY(8px)`,
            transition:
              'transform 0.45s cubic-bezier(0.34, 1.45, 0.64, 1), background 0.35s ease, box-shadow 0.35s ease',
          }}
        >
          {ActiveIcon && (
            <ActiveIcon
              key={activeItem.href}
              className="w-6 h-6 text-white transition-transform duration-300 scale-105"
              strokeWidth={2.2}
            />
          )}
        </div>

        {/* Clickable Tab Targets */}
        <div className="absolute inset-x-0 bottom-0 flex items-center h-[62px] z-20">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIdx;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setActiveIdx(idx)}
                className="flex-1 flex flex-col items-center justify-center h-full active:scale-90 transition-transform duration-150 outline-none"
                aria-label={item.label}
              >
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
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
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full pointer-events-none" />
      </div>
    </nav>
  );
}
