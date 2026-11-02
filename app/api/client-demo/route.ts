/**
 * BANTAY-AGAPAY HTML CLIENT ADAPTER
 * Place at app/api/client-demo/route.ts in the existing Next.js repository.
 * Reuses the existing Supabase project and staff_session authentication.
 * Public actions expose only active destinations and the existing status RPC.
 * Staff lookup requires a valid server-side staff session.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyStaff } from '@/lib/auth/verifyStaff'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action')
  const token = request.nextUrl.searchParams.get('token') || ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Backend environment is not configured.' }, { status: 503 })
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    if (action === 'destinations') {
      const { data, error } = await supabase.from('destinations')
        .select('id,name,building,room,description').eq('active', true).order('name')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ destinations: data || [] })
    }
    if (action === 'status') {
      if (!/^[0-9a-f]{32}$/i.test(token)) {
        return NextResponse.json({ error: 'Invalid visit token.' }, { status: 400 })
      }
      // Matches the original status page's get_visit_status RPC.
      const { data, error } = await supabase.rpc('get_visit_status', { token })
      if (error) return NextResponse.json({ error: 'Could not fetch visit status.' }, { status: 500 })
      if (!data?.length) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 })
      const v = data[0]
      return NextResponse.json({ visit: {
        status: v.status, visitor_name: v.visitor_name,
        reference_number: v.reference_number, destination_name: v.destination_name,
        approved_at: v.approved_at, denied_reason: v.denied_reason,
      } })
    }
    if (action === 'lookup') {
      const staff = await verifyStaff()
      if (!staff) return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401 })
      if (!/^[0-9a-f]{32}$/i.test(token)) {
        return NextResponse.json({ error: 'Invalid visit token.' }, { status: 400 })
      }
      const { data, error } = await supabase.from('visits')
        .select('id,public_token,reference_number,status,purpose,registration_time,check_in,check_out,visitors(full_name,visitor_type,face_reference_path),destinations(name,building)')
        .eq('public_token', token).maybeSingle()
      if (error) return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 })
      if (!data) return NextResponse.json({ error: 'This QR token is not registered.' }, { status: 404 })
      const raw = data as unknown as {
        id: string; public_token: string; reference_number: string; status: string; purpose: string;
        registration_time: string; check_in: string | null; check_out: string | null;
        visitors: { full_name: string; visitor_type: string; face_reference_path: string | null } | null;
        destinations: { name: string; building: string } | null;
      }
      return NextResponse.json({ visit: {
        id: raw.id, token: raw.public_token, reference: raw.reference_number,
        status: raw.status, name: raw.visitors?.full_name || 'Visitor',
        visitorType: raw.visitors?.visitor_type || '', purpose: raw.purpose,
        destination: raw.destinations?.name || '', building: raw.destinations?.building || '',
        photoPath: raw.visitors?.face_reference_path || null,
        registeredAt: raw.registration_time, checkIn: raw.check_in, checkOut: raw.check_out,
      } })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 })
  }
}
