"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,  // 2 minutes
            gcTime: 10 * 60 * 1000,    // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  // Per-user data must never survive an account change: drop every cached query
  // (and the service worker's offline API copies) on sign-out or when a different user signs in.
  useEffect(() => {
    let currentUserId: string | null | undefined;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      // Only a real sign-out or a switch between two accounts counts; the initial
      // session / first sign-in must never wipe in-flight queries.
      const changed =
        event === "SIGNED_OUT" ||
        (!!currentUserId && !!nextUserId && currentUserId !== nextUserId);
      currentUserId = nextUserId;
      if (!changed) return;
      queryClient.cancelQueries();
      queryClient.removeQueries();
      if (typeof caches !== "undefined") {
        caches.keys().then((names) =>
          Promise.all(names.map(async (name) => {
            const cache = await caches.open(name);
            const reqs = await cache.keys();
            await Promise.all(
              reqs
                .filter((r) => new URL(r.url).pathname.startsWith("/api/"))
                .map((r) => cache.delete(r))
            );
          }))
        ).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
