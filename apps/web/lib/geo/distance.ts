/**
 * Distance Calculation Utilities
 * Haversine formula and distance formatting
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates,
): number {
  const lat1Rad = toRadians(point1.latitude);
  const lat2Rad = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate distance in meters
 */
export function calculateDistanceMeters(
  point1: Coordinates,
  point2: Coordinates,
): number {
  return calculateDistance(point1, point2) * 1000;
}

/**
 * Format distance for display
 * Shows in meters for distances < 1km, otherwise in km
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0.001) {
    return 'Here';
  }

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters}m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  }

  return `${Math.round(distanceKm)}km`;
}

/**
 * Format distance with "away" suffix
 */
export function formatDistanceAway(distanceKm: number): string {
  const formatted = formatDistance(distanceKm);
  return formatted === 'Here' ? formatted : `${formatted} away`;
}

/**
 * Check if a point is within a radius of another point
 */
export function isWithinRadius(
  point: Coordinates,
  center: Coordinates,
  radiusKm: number,
): boolean {
  return calculateDistance(point, center) <= radiusKm;
}

/**
 * Sort locations by distance from a point
 */
export function sortByDistance<T extends { latitude: number; longitude: number }>(
  locations: T[],
  fromPoint: Coordinates,
): Array<T & { distance: number }> {
  return locations
    .map((location) => ({
      ...location,
      distance: calculateDistance(
        { latitude: location.latitude, longitude: location.longitude },
        fromPoint,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Get bounding box for a radius around a point
 * Useful for initial database filtering before precise distance calculation
 */
export function getBoundingBox(
  center: Coordinates,
  radiusKm: number,
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const latDelta = radiusKm / 111.32; // 1 degree latitude ≈ 111.32 km
  const lonDelta = radiusKm / (111.32 * Math.cos(toRadians(center.latitude)));

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
}

/**
 * Calculate the center point of multiple coordinates
 */
export function calculateCenterPoint(points: Coordinates[]): Coordinates | null {
  if (points.length === 0) return null;

  if (points.length === 1) return points[0];

  let x = 0;
  let y = 0;
  let z = 0;

  for (const point of points) {
    const latRad = toRadians(point.latitude);
    const lonRad = toRadians(point.longitude);

    x += Math.cos(latRad) * Math.cos(lonRad);
    y += Math.cos(latRad) * Math.sin(lonRad);
    z += Math.sin(latRad);
  }

  const count = points.length;
  x /= count;
  y /= count;
  z /= count;

  const lonRad = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const latRad = Math.atan2(z, hyp);

  return {
    latitude: latRad * (180 / Math.PI),
    longitude: lonRad * (180 / Math.PI),
  };
}

/**
 * Estimate travel time (walking)
 * Assumes average walking speed of 5 km/h
 */
export function estimateWalkingTime(distanceKm: number): number {
  const walkingSpeedKmh = 5;
  return Math.ceil((distanceKm / walkingSpeedKmh) * 60); // Returns minutes
}

/**
 * Format estimated travel time
 */
export function formatTravelTime(minutes: number): string {
  if (minutes < 1) {
    return '< 1 min walk';
  }

  if (minutes < 60) {
    return `${minutes} min walk`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h walk`;
  }

  return `${hours}h ${remainingMinutes}min walk`;
}
