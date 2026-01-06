'use client';

/**
 * Geolocation Utilities
 * Handle browser geolocation API and location services
 */

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface GeoError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';
  message: string;
}

// Default location (Dhaka, Bangladesh) for fallback
export const DEFAULT_LOCATION: GeoPosition = {
  latitude: 23.8103,
  longitude: 90.4125,
};

// Storage key for cached location
const CACHED_LOCATION_KEY = 'sportzen_user_location';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if geolocation is supported in the browser
 */
export function isGeolocationSupported(): boolean {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Get cached location if still valid
 */
export function getCachedLocation(): GeoPosition | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHED_LOCATION_KEY);
    if (!cached) return null;

    const { position, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age < CACHE_DURATION_MS) {
      return position;
    }

    // Clear expired cache
    localStorage.removeItem(CACHED_LOCATION_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache a location
 */
function cacheLocation(position: GeoPosition): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      CACHED_LOCATION_KEY,
      JSON.stringify({
        position,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get current user location
 * Returns cached location if available, otherwise requests new location
 */
export function getCurrentLocation(
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    useCache?: boolean;
  } = {},
): Promise<GeoPosition> {
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 0,
    useCache = true,
  } = options;

  return new Promise((resolve, reject) => {
    // Check cache first
    if (useCache) {
      const cached = getCachedLocation();
      if (cached) {
        resolve(cached);
        return;
      }
    }

    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
      reject({
        code: 'UNSUPPORTED',
        message: 'Geolocation is not supported by this browser',
      } as GeoError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const geoPosition: GeoPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        // Cache the result
        cacheLocation(geoPosition);
        resolve(geoPosition);
      },
      (error) => {
        let geoError: GeoError;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            geoError = {
              code: 'PERMISSION_DENIED',
              message: 'Location access was denied. Please enable location permissions.',
            };
            break;
          case error.POSITION_UNAVAILABLE:
            geoError = {
              code: 'POSITION_UNAVAILABLE',
              message: 'Location information is unavailable.',
            };
            break;
          case error.TIMEOUT:
            geoError = {
              code: 'TIMEOUT',
              message: 'Location request timed out.',
            };
            break;
          default:
            geoError = {
              code: 'POSITION_UNAVAILABLE',
              message: 'An unknown error occurred.',
            };
        }

        reject(geoError);
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  });
}

/**
 * Get location with fallback to default
 */
export async function getLocationWithFallback(
  options?: Parameters<typeof getCurrentLocation>[0],
): Promise<GeoPosition> {
  try {
    return await getCurrentLocation(options);
  } catch {
    return DEFAULT_LOCATION;
  }
}

/**
 * Watch user location for updates
 */
export function watchLocation(
  onUpdate: (position: GeoPosition) => void,
  onError?: (error: GeoError) => void,
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  } = {},
): (() => void) | null {
  if (!isGeolocationSupported()) {
    onError?.({
      code: 'UNSUPPORTED',
      message: 'Geolocation is not supported by this browser',
    });
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const geoPosition: GeoPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      cacheLocation(geoPosition);
      onUpdate(geoPosition);
    },
    (error) => {
      let geoError: GeoError;
      switch (error.code) {
        case error.PERMISSION_DENIED:
          geoError = { code: 'PERMISSION_DENIED', message: 'Permission denied' };
          break;
        case error.POSITION_UNAVAILABLE:
          geoError = { code: 'POSITION_UNAVAILABLE', message: 'Position unavailable' };
          break;
        case error.TIMEOUT:
          geoError = { code: 'TIMEOUT', message: 'Request timed out' };
          break;
        default:
          geoError = { code: 'POSITION_UNAVAILABLE', message: 'Unknown error' };
      }
      onError?.(geoError);
    },
    options,
  );

  // Return cleanup function
  return () => navigator.geolocation.clearWatch(watchId);
}

/**
 * Clear cached location
 */
export function clearCachedLocation(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHED_LOCATION_KEY);
  }
}
