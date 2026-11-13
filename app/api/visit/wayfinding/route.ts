import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GATE_KEY, UUID, availableRoute, point, readGate, readRoute, routeKey } from '@/lib/wayfinding'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
const tokenPattern = /^[a-f0-9]{32}$/i

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  if (!tokenPattern.test(token)) return NextResponse.json({ error: 'Invalid visitor QR token' }, { status: 400 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: visit, error } = await supabase.from('visits')
    .select('status,destinations(id,name,building,floor,room,landmark,directions,map_x,map_y,active)')
    .eq('public_token', token).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load visitor directions' }, { status: 500 })
  if (!visit) return NextResponse.json({ error: 'Visitor pass not found' }, { status: 404 })
  type Destination = { id: string; name: string; building: string | null; floor: string | null;
    room: string | null; landmark: string | null; directions: string | null;
    map_x: number | null; map_y: number | null; active: boolean }
  const d = (visit as unknown as { destinations: Destination | null }).destinations
  if (!d) return NextResponse.json({ error: 'Destination unavailable' }, { status: 404 })
  const destination = {
    name: d.name, building: d.building, floor: d.floor,
    room: d.room, landmark: d.landmark, directions: d.directions,
    map_x: d.map_x, map_y: d.map_y,
  }
  // Entry has to be approved by security before showing a visitor walking route.
  if (visit.status !== 'INSIDE' || !d.active) {
    return NextResponse.json({ status: visit.status, destination, available: false,
      message: 'Walking directions become available after security approves entry.' }, { headers })
  }
  if (!UUID.test(d.id)) return NextResponse.json({ error: 'Invalid destination' }, { status: 500 })
  const { data: rows, error: settingsError } = await supabase.from('system_settings')
    .select('key,value').in('key', [GATE_KEY, routeKey(d.id)])
  if (settingsError) return NextResponse.json({ error: 'Campus route lookup failed' }, { status: 500 })
  const settings = new Map((rows || []).map(row => [row.key, row.value as string]))
  const gate = readGate(settings.get(GATE_KEY))
  const path = availableRoute(
    readRoute(settings.get(routeKey(d.id))),
    gate,
    d.map_x === null || d.map_y === null ? null : point({ x: Number(d.map_x), y: Number(d.map_y) }),
  )
  return NextResponse.json({
    status: visit.status, destination, available: Boolean(path),
    points: path?.points || null,
    instructions: path?.instructions || null,
    message: path ? null : 'No approved walking path is published yet. Ask the school guard for directions.',
  }, { headers })
}
