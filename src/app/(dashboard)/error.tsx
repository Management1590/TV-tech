'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Hard refresh ensures complete re-execution of server components and DB connection retries
    if (typeof window !== 'undefined') {
      window.location.reload();
    } else {
      reset();
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      router.push('/knowledge-base');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-5 shadow-xs">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl sm:text-2xl font-black text-foreground mb-2">Something went wrong</h2>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        {error.message || 'An unexpected database or server error occurred. Please refresh or try again.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2 font-bold px-5 h-10 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing Page...' : 'Try Again (Refresh)'}
        </Button>

        <Button
          variant="outline"
          onClick={handleBack}
          className="gap-2 font-semibold px-4 h-10 rounded-xl cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>

        <Button
          variant="ghost"
          onClick={() => router.push('/knowledge-base')}
          className="gap-2 font-semibold px-4 h-10 rounded-xl cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <BookOpen className="h-4 w-4 text-primary" />
          Knowledge Base
        </Button>
      </div>
    </div>
  );
}
