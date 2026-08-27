'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, FolderTree, BookOpen, ShoppingBag, BarChart3 } from 'lucide-react';

interface BottomNavProps {
  userRole?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ userRole = 'STAFF' }) => {
  const pathname = usePathname();
  const isItemDetailPage = pathname.startsWith('/inventory/items/');

  // On individual item pages, the dedicated Item CTA bar replaces the general bottom navigation
  if (isItemDetailPage) {
    return null;
  }

  const isKbRoute = pathname.startsWith('/knowledge-base');
  const isAdmin = userRole === 'ADMIN';

  let navItems: { label: string; href: string; icon: any }[] = [];

  if (!isAdmin) {
    // For Staff: Dashboard, Purchases, Analytics are inaccessible and hidden
    navItems = isKbRoute
      ? [
          { label: 'Knowledge', href: '/knowledge-base', icon: BookOpen },
          { label: 'Inventory', href: '/inventory', icon: FolderTree },
        ]
      : [
          { label: 'Inventory', href: '/inventory', icon: FolderTree },
          { label: 'Knowledge', href: '/knowledge-base', icon: BookOpen },
        ];
  } else {
    // For Admin: Full system navigation
    navItems = isKbRoute
      ? [
          { label: 'Knowledge', href: '/knowledge-base', icon: BookOpen },
          { label: 'Inventory', href: '/inventory', icon: FolderTree },
          { label: 'Purchases', href: '/purchase-manager', icon: ShoppingBag },
          { label: 'Analytics', href: '/analytics', icon: BarChart3 },
        ]
      : [
          { label: 'Dashboard', href: '/', icon: LayoutGrid },
          { label: 'Inventory', href: '/inventory', icon: FolderTree },
          { label: 'Purchases', href: '/purchase-manager', icon: ShoppingBag },
          { label: 'Knowledge', href: '/knowledge-base', icon: BookOpen },
          { label: 'Analytics', href: '/analytics', icon: BarChart3 },
        ];
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border shadow-[0_-2px_8px_rgba(100,116,145,0.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] min-w-[48px] min-h-[48px] rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
                isActive ? 'bg-primary/10' : ''
              }`}>
                <Icon className="w-[22px] h-[22px]" />
              </div>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
