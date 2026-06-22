import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Slightly longer stale time for mobile to reduce unnecessary refetches
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 2,
      refetchOnWindowFocus: false, // Not relevant on mobile
    },
    mutations: {
      retry: 1,
    },
  },
});
