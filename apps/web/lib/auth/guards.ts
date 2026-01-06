'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getStoredUser, hasAnyRole, StoredUser } from './session';

/**
 * Route configuration for role-based access
 */
export const ROLE_ROUTES: Record<string, StoredUser['role'][]> = {
  '/dashboard': ['PLAYER'],
  '/bookings': ['PLAYER'],
  '/favorites': ['PLAYER'],
  '/profile': ['PLAYER', 'OWNER', 'OWNER_STAFF', 'SUPER_ADMIN'],
  '/owner': ['OWNER', 'OWNER_STAFF'],
  '/admin': ['SUPER_ADMIN'],
};

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/',
  '/turfs',
  '/auth/login',
  '/auth/register',
  '/auth/phone',
  '/legal/terms',
  '/legal/privacy',
];

/**
 * Check if a route is public
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === pathname) return true;
    // Check if it's a dynamic route under public routes
    if (route.endsWith('/') && pathname.startsWith(route)) return true;
    // Handle /turfs/[facilityId] pattern
    if (route === '/turfs' && pathname.startsWith('/turfs/')) return true;
    return false;
  });
}

/**
 * Get required roles for a route
 */
export function getRequiredRoles(pathname: string): StoredUser['role'][] | null {
  // Check exact match first
  if (ROLE_ROUTES[pathname]) {
    return ROLE_ROUTES[pathname];
  }

  // Check prefix match
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route + '/')) {
      return roles;
    }
  }

  return null;
}

/**
 * Hook to protect routes and redirect unauthorized users
 */
export function useAuthGuard(): {
  isLoading: boolean;
  isAuthorized: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip for public routes
    if (isPublicRoute(pathname)) return;

    // Check authentication
    if (!isAuthenticated()) {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/auth/login?returnUrl=${returnUrl}`);
      return;
    }

    // Check role authorization
    const requiredRoles = getRequiredRoles(pathname);
    if (requiredRoles && !hasAnyRole(requiredRoles)) {
      // Redirect to appropriate home page based on role
      const user = getStoredUser();
      if (user) {
        switch (user.role) {
          case 'OWNER':
          case 'OWNER_STAFF':
            router.replace('/owner');
            break;
          case 'SUPER_ADMIN':
            router.replace('/admin');
            break;
          default:
            router.replace('/dashboard');
        }
      } else {
        router.replace('/auth/login');
      }
    }
  }, [pathname, router]);

  // Determine loading and authorization status
  if (isPublicRoute(pathname)) {
    return { isLoading: false, isAuthorized: true };
  }

  if (!isAuthenticated()) {
    return { isLoading: true, isAuthorized: false };
  }

  const requiredRoles = getRequiredRoles(pathname);
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return { isLoading: true, isAuthorized: false };
  }

  return { isLoading: false, isAuthorized: true };
}

/**
 * Hook to redirect authenticated users away from auth pages
 */
export function useRedirectIfAuthenticated(
  redirectTo: string = '/dashboard',
): void {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      const user = getStoredUser();
      if (user) {
        // Redirect based on role
        switch (user.role) {
          case 'OWNER':
          case 'OWNER_STAFF':
            router.replace('/owner');
            break;
          case 'SUPER_ADMIN':
            router.replace('/admin');
            break;
          default:
            router.replace(redirectTo);
        }
      } else {
        router.replace(redirectTo);
      }
    }
  }, [router, redirectTo]);
}

/**
 * Get home route for a user role
 */
export function getHomeRoute(role: StoredUser['role']): string {
  switch (role) {
    case 'OWNER':
    case 'OWNER_STAFF':
      return '/owner';
    case 'SUPER_ADMIN':
      return '/admin';
    default:
      return '/dashboard';
  }
}

/**
 * Check if current user can access owner features
 */
export function canAccessOwnerFeatures(): boolean {
  return hasAnyRole(['OWNER', 'OWNER_STAFF']);
}

/**
 * Check if current user can access admin features
 */
export function canAccessAdminFeatures(): boolean {
  return hasAnyRole(['SUPER_ADMIN']);
}
