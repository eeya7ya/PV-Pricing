import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface AuthUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
}

type LoginCreds = { username: string; password: string };

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<AuthUser, Error, LoginCreds>;
  demoLoginMutation: UseMutationResult<AuthUser, Error, string>;
  logoutMutation: UseMutationResult<void, Error, void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<AuthUser | null, Error>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation<AuthUser, Error, LoginCreds>({
    mutationFn: async (creds) => {
      const res = await apiRequest("POST", "/api/login", creds);
      return (await res.json()) as AuthUser;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({ title: "Welcome back", description: `Signed in as ${data.username}` });
    },
    onError: (err) => {
      toast({ title: "Sign-in failed", description: err.message, variant: "destructive" });
    },
  });

  const demoLoginMutation = useMutation<AuthUser, Error, string>({
    mutationFn: async (as) => {
      const res = await apiRequest("POST", "/api/demo-login", { as });
      return (await res.json()) as AuthUser;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({ title: "Demo access", description: `Signed in as ${data.username}` });
    },
    onError: (err) => {
      toast({ title: "Demo sign-in failed", description: err.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      toast({ title: "Logged out", description: "You have been successfully logged out." });
    },
    onError: (err) => {
      toast({ title: "Logout failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        demoLoginMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
