'use client';

/**
 * Session Management
 * Handles token storage and retrieval for authentication
 */

const ACCESS_TOKEN_KEY = 'sportzen_access_token';
const REFRESH_TOKEN_KEY = 'sportzen_refresh_token';
const USER_KEY = 'sportzen_user';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: 'PLAYER' | 'OWNER' | 'OWNER_STAFF' | 'SUPER_ADMIN';
  phone?: string;
  phoneVerified?: boolean;
}

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Set access token
 */
export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * Remove access token
 */
export function removeAccessToken(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Set refresh token
 */
export function setRefreshToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Remove refresh token
 */
export function removeRefreshToken(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Get stored user data
 */
export function getStoredUser(): StoredUser | null {
  if (!isBrowser()) return null;
  const userData = localStorage.getItem(USER_KEY);
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

/**
 * Set user data
 */
export function setStoredUser(user: StoredUser): void {
  if (!isBrowser()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Remove stored user data
 */
export function removeStoredUser(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(USER_KEY);
}

/**
 * Store all session data
 */
export function setSession(data: {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}): void {
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  setStoredUser(data.user);
}

/**
 * Clear all session data
 */
export function clearSession(): void {
  removeAccessToken();
  removeRefreshToken();
  removeStoredUser();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Check if user has a specific role
 */
export function hasRole(requiredRole: StoredUser['role']): boolean {
  const user = getStoredUser();
  return user?.role === requiredRole;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roles: StoredUser['role'][]): boolean {
  const user = getStoredUser();
  return user ? roles.includes(user.role) : false;
}

/**
 * Decode JWT token payload (without verification)
 * Only use for client-side display, not for security decisions
 */
export function decodeToken(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if access token is expired
 */
export function isTokenExpired(): boolean {
  const token = getAccessToken();
  if (!token) return true;

  const decoded = decodeToken(token);
  if (!decoded?.exp) return true;

  // Add 30 second buffer
  return decoded.exp * 1000 < Date.now() + 30000;
}

/**
 * Get time until token expires (in ms)
 */
export function getTokenExpiryTime(): number | null {
  const token = getAccessToken();
  if (!token) return null;

  const decoded = decodeToken(token);
  if (!decoded?.exp) return null;

  return decoded.exp * 1000 - Date.now();
}
