/** Campus wayfinding coordinate model (map-image pixels, not GPS). */
export type MapPoint = { x: number; y: number }
export type StoredRoute = {
  version: 1
  points: MapPoint[]
  published: boolean
  instructions: string
  updatedAt: string
}
export const MAP_WIDTH = 2048
export const MAP_HEIGHT = 1536
export const GATE_KEY = 'campus_wayfinding_gate_v1'
export const routeKey = (id: string) => 'campus_wayfinding_route_' + id
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export function point(value: unknown): MapPoint | null {
  if (!value || typeof value !== 'object') return null
  const p = value as Record<string, unknown>
  if (typeof p.x !== 'number' || typeof p.y !== 'number' ||
      !Number.isInteger(p.x) || !Number.isInteger(p.y) ||
      p.x < 0 || p.x > MAP_WIDTH || p.y < 0 || p.y > MAP_HEIGHT) return null
  return { x: p.x, y: p.y }
}
export function samePoint(a: MapPoint, b: MapPoint): boolean {
  return a.x === b.x && a.y === b.y
}
export function readGate(raw: string | null | undefined): MapPoint | null {
  if (!raw || raw.length > 200) return null
  try { return point(JSON.parse(raw)) } catch { return null }
}
export function readRoute(raw: string | null | undefined): StoredRoute | null {
  if (!raw || raw.length > 18000) return null
  try {
    const item = JSON.parse(raw) as Record<string, unknown>
    if (!item || item.version !== 1 || typeof item.published !== 'boolean' ||
      typeof item.instructions !== 'string' || item.instructions.length > 1200 ||
      !Array.isArray(item.points) || item.points.length > 64) return null
    const pts = item.points.map(point)
    if (pts.some(p => !p)) return null
    return {
      version: 1, points: pts as MapPoint[], published: item.published,
      instructions: item.instructions,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : ''
    }
  } catch { return null }
}
export function checkRoute(points: unknown, gate: MapPoint, destination: MapPoint): string | null {
  if (!Array.isArray(points) || points.length < 3 || points.length > 64) {
    return 'Add at least one walkway waypoint; the complete route must have 3–64 points.'
  }
  const pts = points.map(point)
  if (pts.some(p => p === null)) return 'All points must be valid campus map coordinates.'
  const valid = pts as MapPoint[]
  if (!samePoint(valid[0], gate)) return 'The route must start at the configured school gate.'
  if (!samePoint(valid[valid.length - 1], destination)) return 'The route must end at the destination pin.'
  for (let i = 1; i < valid.length; i++) {
    const dx = valid[i].x - valid[i - 1].x
    const dy = valid[i].y - valid[i - 1].y
    if (Math.hypot(dx, dy) < 3) return 'Consecutive path points are too close together.'
  }
  return null
}
export function availableRoute(route: StoredRoute | null, gate: MapPoint | null, dest: MapPoint | null): StoredRoute | null {
  if (!route || !gate || !dest || !route.published || checkRoute(route.points, gate, dest)) return null
  return route
}
