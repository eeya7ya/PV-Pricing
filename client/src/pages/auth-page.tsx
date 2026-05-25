import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sun, BarChart3, User, Shield, Wrench } from 'lucide-react';
import { Redirect } from 'wouter';

export default function AuthPage() {
  const { user, isLoading, loginMutation, demoLoginMutation } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    loginMutation.mutate({ username, password });
  };

  const isBusy = loginMutation.isPending || demoLoginMutation.isPending || isLoading;

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-orange-900">
      <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-slate-900/60 to-orange-600/40 animate-pulse opacity-75" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-orange-500/10 rounded-full blur-xl animate-bounce" style={{ animationDuration: '6s' }} />
        <div className="absolute top-40 right-32 w-24 h-24 bg-amber-400/15 rounded-full blur-lg animate-bounce" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        <div className="absolute bottom-32 left-40 w-20 h-20 bg-yellow-500/10 rounded-full blur-xl animate-bounce" style={{ animationDuration: '7s', animationDelay: '4s' }} />
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-orange-600/8 rounded-full blur-lg animate-bounce" style={{ animationDuration: '9s', animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="relative mx-auto w-fit">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full blur-xl opacity-40 animate-pulse" />
              <img
                src="/espark-logo.png"
                alt="eSpark"
                className="relative mx-auto h-24 w-auto object-contain drop-shadow-2xl"
                data-testid="img-auth-logo"
              />
            </div>
            <h2 className="mt-8 text-4xl font-bold tracking-tight text-white">
              eSpark PV Calculator
            </h2>
            <p className="mt-2 text-sm text-orange-300/90 font-medium tracking-wide" data-testid="text-credits-auth">
              Created by ENG.Yahya-Khaleld
            </p>
            <p className="mt-3 text-lg text-orange-200/90">
              Professional solar system analysis tool
            </p>
          </div>

          <Card className="relative backdrop-blur-sm bg-white/10 border-orange-500/20 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl" />
            <CardHeader className="relative">
              <CardTitle className="text-white text-center text-xl">Sign In</CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-orange-100">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin / user / engineer"
                    autoComplete="username"
                    data-testid="input-username"
                    className="bg-white/10 border-orange-500/30 text-white placeholder:text-orange-200/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-orange-100">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    data-testid="input-password"
                    className="bg-white/10 border-orange-500/30 text-white placeholder:text-orange-200/40"
                  />
                </div>

                {loginMutation.isError && (
                  <p className="text-sm text-red-300" data-testid="text-login-error">
                    {loginMutation.error?.message || 'Login failed'}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isBusy}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold h-12 text-lg shadow-lg shadow-orange-600/25 border-0"
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing in…</>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-orange-500/20">
                <p className="text-xs uppercase tracking-wider text-orange-200/70 text-center mb-3">
                  Quick demo access
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => demoLoginMutation.mutate('admin')}
                    className="bg-white/5 border-orange-500/30 text-orange-100 hover:bg-orange-500/20 hover:text-white"
                    data-testid="button-demo-admin"
                  >
                    <Shield className="h-4 w-4 mr-1" /> Admin
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => demoLoginMutation.mutate('user')}
                    className="bg-white/5 border-orange-500/30 text-orange-100 hover:bg-orange-500/20 hover:text-white"
                    data-testid="button-demo-user"
                  >
                    <User className="h-4 w-4 mr-1" /> User
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => demoLoginMutation.mutate('engineer')}
                    className="bg-white/5 border-orange-500/30 text-orange-100 hover:bg-orange-500/20 hover:text-white"
                    data-testid="button-demo-engineer"
                  >
                    <Wrench className="h-4 w-4 mr-1" /> Engineer
                  </Button>
                </div>
                <p className="text-xs text-orange-200/50 text-center mt-3">
                  admin/admin123 · user/user123 · engineer/engineer123
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-orange-500/20">
              <Sun className="h-6 w-6 text-orange-400 mx-auto mb-2" />
              <p className="text-sm text-orange-200">Solar Analysis</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-orange-500/20">
              <BarChart3 className="h-6 w-6 text-orange-400 mx-auto mb-2" />
              <p className="text-sm text-orange-200">ROI Calculation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
