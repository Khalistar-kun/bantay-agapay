// AFGBMTS School coordinates (Caloocan, Philippines)
const SCHOOL_COORDINATES = {
  latitude: 14.2225,
  longitude: 121.0115,
}

// Geofence radius in meters (500m = 0.5km)
const GEOFENCE_RADIUS = 500

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Verify if location is within school geofence
 */
export function isWithinGeofence(lat: number, lon: number): {
  verified: boolean
  distance: number
  accuracy: number
} {
  const distance = calculateDistance(lat, lon, SCHOOL_COORDINATES.latitude, SCHOOL_COORDINATES.longitude)

  return {
    verified: distance <= GEOFENCE_RADIUS,
    distance: Math.round(distance),
    accuracy: 25, // Mock accuracy in meters
  }
}

/**
 * Get mock location for testing (AFGBMTS coordinates)
 */
export function getMockLocation() {
  return {
    latitude: SCHOOL_COORDINATES.latitude,
    longitude: SCHOOL_COORDINATES.longitude,
    accuracy: 25,
  }
}

/**
 * Get real location using browser geolocation API
 */
export async function getRealLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

/**
 * Get location (real or mock based on environment)
 */
export async function getLocation(useMock: boolean = true) {
  if (useMock) {
    return getMockLocation()
  }

  return getRealLocation()
}

/**
 * School settings
 */
export const SCHOOL_INFO = {
  name: "AFGBMTS",
  coordinates: SCHOOL_COORDINATES,
  geofenceRadius: GEOFENCE_RADIUS,
}
