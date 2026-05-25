import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface AuthUser {
  id: number | string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
}

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  googleLoginMutation: UseMutationResult<AuthUser, Error, string>;
  guestLoginMutation: UseMutationResult<AuthUser, Error, void>;
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

  const googleLoginMutation = useMutation<AuthUser, Error, string>({
    mutationFn: async (credential) => {
      const res = await apiRequest("POST", "/api/auth/google", { credential });
      return (await res.json()) as AuthUser;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({ title: "Signed in", description: `Welcome, ${data.firstName || data.email}` });
    },
    onError: (err) => {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
    },
  });

  const guestLoginMutation = useMutation<AuthUser, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/guest-login");
      return (await res.json()) as AuthUser;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({ title: "Guest access", description: "Signed in as a guest" });
    },
    onError: (err) => {
      toast({ title: "Guest sign-in failed", description: err.message, variant: "destructive" });
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
        googleLoginMutation,
        guestLoginMutation,
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
