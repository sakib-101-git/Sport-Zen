'use client';

import { QueryClient } from '@tanstack/react-query';

/**
 * Create a new QueryClient instance with default options
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: how long data is considered fresh (5 minutes)
        staleTime: 5 * 60 * 1000,

        // Cache time: how long inactive data stays in cache (30 minutes)
        gcTime: 30 * 60 * 1000,

        // Retry configuration
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.statusCode >= 400 && error?.statusCode < 500) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },

        // Retry delay with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch on window focus (useful for keeping data fresh)
        refetchOnWindowFocus: true,

        // Don't refetch on reconnect by default
        refetchOnReconnect: false,

        // Network mode
        networkMode: 'online',
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,

        // Network mode
        networkMode: 'online',
      },
    },
  });
}

// Singleton instance for client-side
let browserQueryClient: QueryClient | undefined;

/**
 * Get or create the QueryClient instance
 * Creates a new instance on the server, reuses on the client
 */
export function getQueryClient(): QueryClient {
  // Server: always create a new client
  if (typeof window === 'undefined') {
    return createQueryClient();
  }

  // Client: reuse the same client
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }

  return browserQueryClient;
}

/**
 * Reset the query client (useful for logout)
 */
export function resetQueryClient(): void {
  if (browserQueryClient) {
    browserQueryClient.clear();
  }
}

/**
 * Prefetch common data
 */
export async function prefetchCommonData(queryClient: QueryClient): Promise<void> {
  // Add any common prefetching here
  // Example: prefetch sport types, areas, etc.
}

/**
 * Invalidate booking-related queries
 */
export function invalidateBookingQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['bookings'] });
  queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
}

/**
 * Invalidate facility-related queries
 */
export function invalidateFacilityQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['facilities'] });
  queryClient.invalidateQueries({ queryKey: ['nearby-facilities'] });
  queryClient.invalidateQueries({ queryKey: ['owner-facilities'] });
}

/**
 * Invalidate all queries (e.g., after login/logout)
 */
export function invalidateAllQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries();
}
