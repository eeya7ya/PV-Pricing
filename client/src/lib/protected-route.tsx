import { useAuth } from "@/hooks/use-auth";
import { Loader2, Calculator } from "lucide-react";
import { Route } from "wouter";
import AuthPage from "@/pages/auth-page";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  return (
    <Route path={path}>
      <ProtectedRouteContent Component={Component} />
    </Route>
  );
}

function ProtectedRouteContent({ Component }: { Component: () => React.JSX.Element }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AuthSplash />;
  }

  // Render the auth page in place rather than redirecting to /auth — the
  // redirect caused a visible double render / flash on first load.
  if (!user) {
    return <AuthPage />;
  }

  return <Component />;
}

// Branded full-screen loader shown while the session is being resolved, so the
// first paint isn't a blank screen with a near-invisible spinner.
function AuthSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-900">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full blur-lg opacity-30 animate-pulse" />
        <Calculator className="relative h-14 w-14 text-orange-400" />
      </div>
      <div className="flex items-center gap-2 text-orange-200/80">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading eSpark Solar Calculator…</span>
      </div>
    </div>
  );
}
