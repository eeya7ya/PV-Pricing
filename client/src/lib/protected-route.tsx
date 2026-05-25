import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
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

// Neutral loader shown while the session is being resolved. Deliberately
// plain (no logo/gradient) so it is not mistaken for the login screen — a
// login-lookalike splash reads as the login "rendering twice".
function AuthSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
    </div>
  );
}
