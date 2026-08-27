import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-8xl font-bold text-muted-foreground/20 mb-4">404</div>
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Link href="/inventory">
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" /> Inventory
          </Button>
        </Link>
      </div>
    </div>
  );
}
