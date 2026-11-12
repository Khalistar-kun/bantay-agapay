import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyStaff } from '@/lib/auth/verifyStaff'
import { GATE_KEY, UUID, checkRoute, point, readGate, readRoute, routeKey } from '@/lib/wayfinding'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
}

export async function GET(request: NextRequest) {
  const staff = await verifyStaff()
  if (staff?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 })
  const supabase = db()
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const destinationId = request.nextUrl.searchParams.get('destinationId')
  if (destinationId && !UUID.test(destinationId)) return NextResponse.json({ error: 'Invalid destination' }, { status: 400 })
  const keys = destinationId ? [GATE_KEY, routeKey(destinationId)] : [GATE_KEY]
  const { data, error } = await supabase.from('system_settings').select('key,value').in('key', keys)
  if (error) return NextResponse.json({ error: 'Could not load route settings' }, { status: 500 })
  const settings = new Map((data || []).map(item => [item.key, item.value as string]))
  const gate = readGate(settings.get(GATE_KEY))
  const route = destinationId ? readRoute(settings.get(routeKey(destinationId))) : null
  return NextResponse.json({ gate, route }, { headers: noStore })
}

export async function PUT(request: NextRequest) {
  const staff = await verifyStaff()
  if (staff?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Cross-origin changes are blocked' }, { status: 403 })
  const supabase = db()
  if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if ((Number(request.headers.get('content-length') || 0)) > 20000) return NextResponse.json({ error: 'Route payload too large' }, { status: 413 })
  const input = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  if (input.action === 'gate') {
    const gate = point(input.gate)
    if (!gate) return NextResponse.json({ error: 'Choose a valid location on the campus map' }, { status: 400 })
    const { error } = await supabase.from('system_settings').upsert({ key: GATE_KEY, value: JSON.stringify(gate) }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: 'Could not save the school gate' }, { status: 500 })
    return NextResponse.json({ gate }, { headers: noStore })
  }
  if (input.action !== 'route' || typeof input.destinationId !== 'string' || !UUID.test(input.destinationId)) {
    return NextResponse.json({ error: 'Invalid route request' }, { status: 400 })
  }
  if (typeof input.published !== 'boolean' || typeof input.instructions !== 'string' || input.instructions.length > 1200 ||
    !Array.isArray(input.points) || input.points.length > 64 || input.points.some((p: unknown) => !point(p))) {
    return NextResponse.json({ error: 'Route must contain valid map points and up to 1,200 characters of directions' }, { status: 400 })
  }
  const { data: destination, error: destinationError } = await supabase.from('destinations')
    .select('id,map_x,map_y,active').eq('id', input.destinationId).maybeSingle()
  if (destinationError) return NextResponse.json({ error: 'Destination lookup failed' }, { status: 500 })
  if (!destination) return NextResponse.json({ error: 'Destination not found' }, { status: 404 })
  if (!destination.active && input.published) return NextResponse.json({ error: 'Activate this destination before publishing its route' }, { status: 400 })
  if (input.published) {
    const { data: gateRow, error: gateError } = await supabase.from('system_settings').select('value').eq('key', GATE_KEY).maybeSingle()
    if (gateError) return NextResponse.json({ error: 'Gate lookup failed' }, { status: 500 })
    const gate = readGate(gateRow?.value)
    const end = point({ x: Number(destination.map_x), y: Number(destination.map_y) })
    if (!gate || !end || destination.map_x === null || destination.map_y === null) {
      return NextResponse.json({ error: 'Set the school gate and destination pin before publishing' }, { status: 400 })
    }
    const issue = checkRoute(input.points, gate, end)
    if (issue) return NextResponse.json({ error: issue }, { status: 400 })
  }
  const saved = {
    version: 1,
    points: input.points,
    instructions: input.instructions.trim(),
    published: input.published,
    updatedAt: new Date().toISOString(),
  }
  const { error: saveError } = await supabase.from('system_settings').upsert(
    { key: routeKey(input.destinationId), value: JSON.stringify(saved) }, { onConflict: 'key' }
  )
  if (saveError) return NextResponse.json({ error: 'Could not save walking route' }, { status: 500 })
  return NextResponse.json({ route: saved }, { headers: noStore })
}
