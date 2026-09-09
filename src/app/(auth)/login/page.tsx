'use client';

import React, { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Mail, Loader2, AlertCircle, Sparkles, Tv } from 'lucide-react';
import { AppLogo } from '@/components/shared/app-logo';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginAction } from '@/features/auth/actions/auth.actions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const redirectPath = searchParams.get('redirect') || '/';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await loginAction(email, password);

        if (!result.success) {
          setError(result.error || 'Invalid email or password.');
        } else {
          router.push(redirectPath);
          router.refresh();
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-indigo-50/40 to-slate-100 relative overflow-hidden w-full select-none">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-300">
        <Card className="border border-border/80 shadow-sm-2xl bg-white/95 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm-blend">
          <CardHeader className="space-y-3 pb-6 pt-8 text-center border-b border-border/60 bg-gradient-to-b from-slate-50/90 to-white">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white border border-border shadow-md flex items-center justify-center p-2.5">
              <AppLogo className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tight text-foreground">
                MODERN ELECTRONICS
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                TV Tech OS • Enterprise Portal
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="animate-in fade-in duration-200">
                  <Alert variant="destructive" className="bg-red-50/80 border-red-200 text-red-700 py-2.5 rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-foreground">Email Address</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@modernelectronics.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-muted/70 border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary rounded-xl text-sm"
                    required
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold text-foreground">Password</Label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/70 border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary rounded-xl text-sm"
                    required
                    disabled={isPending}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm-lg shadow-sm-primary/15 transition-all font-bold text-sm rounded-xl cursor-pointer mt-2"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating Session...
                  </>
                ) : (
                  'Sign In to TV Tech OS'
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2.5 border-t border-border/60 bg-muted/60 p-4 text-xs text-muted-foreground">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Password Protected • Enterprise Access Control</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

