import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

const DEFAULT_USER = {
  id: 1,
  openId: "local-dev-user",
  name: "SmartSpend User",
  email: "user@smartspend.local",
  role: "admin" as const,
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    // Authentication is bypassed; no login or logout required
  }, []);

  const state = useMemo(() => {
    const user = meQuery.data ?? DEFAULT_USER;
    return {
      user,
      loading: false,
      error: null,
      isAuthenticated: true,
    };
  }, [meQuery.data]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
