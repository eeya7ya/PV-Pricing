import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calculator, Sun, BarChart3, UserRound } from 'lucide-react';
import { Redirect } from 'wouter';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** Loads Google Identity Services and renders the official sign-in button.
 *  Calls `onCredential` with the returned ID token (JWT). */
function GoogleSignInButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    const render = () => {
      // Render exactly once — the script's load event can fire across mounts,
      // and Google's widget otherwise repaints, which looks like a double render.
      if (cancelled || renderedRef.current) return;
      if (!window.google?.accounts?.id || !divRef.current) return;
      renderedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: { credential?: string }) => {
          if (resp?.credential) cbRef.current(resp.credential);
        },
      });
      divRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
        locale: 'en',
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return;
    }
    const existing = document.getElementById('gsi-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', render);
      return () => existing.removeEventListener('load', render);
    }
    const script = document.createElement('script');
    script.id = 'gsi-script';
    // hl=en forces English regardless of the visitor's Google account locale.
    script.src = 'https://accounts.google.com/gsi/client?hl=en';
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="text-xs text-orange-200/60 text-center leading-relaxed">
        Google sign-in isn’t configured yet. Set <code className="text-orange-200/80">VITE_GOOGLE_CLIENT_ID</code> to enable it.
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <div ref={divRef} data-testid="google-signin-button" />
    </div>
  );
}

export default function AuthPage() {
  const { user, isLoading, googleLoginMutation, guestLoginMutation } = useAuth();

  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  const isBusy = googleLoginMutation.isPending || guestLoginMutation.isPending || isLoading;

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
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full blur-lg opacity-30 animate-pulse" />
              <Calculator className="relative mx-auto h-16 w-16 text-orange-400" />
            </div>
            <h2 className="mt-8 text-4xl font-bold tracking-tight text-white">
              eSpark Solar Calculator
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
            <CardContent className="relative space-y-5">
              <div className="min-h-[44px] flex items-center justify-center">
                {googleLoginMutation.isPending ? (
                  <div className="flex items-center gap-2 text-orange-100">
                    <Loader2 className="h-5 w-5 animate-spin" /> Signing in…
                  </div>
                ) : (
                  <GoogleSignInButton onCredential={(c) => googleLoginMutation.mutate(c)} />
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-orange-500/20" />
                <span className="text-xs uppercase tracking-wider text-orange-200/60">or</span>
                <span className="h-px flex-1 bg-orange-500/20" />
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => guestLoginMutation.mutate()}
                className="w-full bg-white/5 border-orange-500/30 text-orange-100 hover:bg-orange-500/20 hover:text-white h-12 text-base"
                data-testid="button-guest"
              >
                {guestLoginMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing in…</>
                ) : (
                  <><UserRound className="mr-2 h-5 w-5" /> Continue as guest</>
                )}
              </Button>

              <p className="text-xs text-orange-200/50 text-center">
                Guest sessions are not saved. Sign in with Google to use your own account.
              </p>
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
