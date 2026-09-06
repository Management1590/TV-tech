'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Search, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/knowledge-base');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-7xl sm:text-8xl font-black text-muted-foreground/20 mb-3 select-none">404</div>
      <h2 className="text-xl sm:text-2xl font-black text-foreground mb-2">Page Not Found</h2>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-7 leading-relaxed">
        The item or folder you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={handleBack}
          className="gap-2 font-bold px-5 h-10 rounded-xl cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
        <Link href="/knowledge-base">
          <Button variant="outline" className="gap-2 font-semibold px-4 h-10 rounded-xl cursor-pointer">
            <BookOpen className="h-4 w-4 text-primary" /> Knowledge Base
          </Button>
        </Link>
        <Link href="/inventory">
          <Button variant="ghost" className="gap-2 font-semibold px-4 h-10 rounded-xl cursor-pointer text-muted-foreground hover:text-foreground">
            <Search className="h-4 w-4" /> Inventory
          </Button>
        </Link>
      </div>
    </div>
  );
}
