import React from 'react';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ScrollToTopButton } from '@/components/shared/scroll-to-top-button';
import { RouteScrollRestorer } from '@/components/shared/route-scroll-restorer';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8 relative">
      {/* Route-Aware Instant Scroll Restoration Engine */}
      <RouteScrollRestorer />

      {/* Sticky Header with Universal Search */}
      <Header user={user} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>

      {/* Special Floating Scroll to Top Button */}
      <ScrollToTopButton />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav userRole={user?.role} />
    </div>
  );
}
