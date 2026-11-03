/**
 * BANTAY-AGAPAY HTML CLIENT ADAPTER
 * Place at app/api/client-demo/route.ts in the existing Next.js repository.
 * Reuses the existing Supabase project and staff_session authentication.
 * Public actions expose only active destinations and the existing status RPC.
 * Staff lookup requires a valid server-side staff session.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { verifyStaff } from '@/lib/auth/verifyStaff'

export const dynamic = 'force-dynamic'

const campusDefaults = { latitude: 14.737, longitude: 120.9728, radius: 500 }

function isCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

async function getCampusBoundary(supabase: any) {
  const { data, error } = await supabase.from('system_settings').select('key,value')
  if (error) return null
  const settings = new Map((data || []).map((entry: { key: string; value: string }) => [entry.key, entry.value]))
  const latitude = Number(settings.get('school_latitude') ?? campusDefaults.latitude)
  const longitude = Number(settings.get('school_longitude') ?? campusDefaults.longitude)
  const radius = Number(settings.get('geofence_radius') ?? campusDefaults.radius)
  if (!isCoordinate(latitude, longitude) || !Number.isFinite(radius) || radius < 10 || radius > 10000) return null
  return { latitude, longitude, radius }
}

function campusDistance(lat: number, lon: number, targetLat: number, targetLon: number) {
  const rad = Math.PI / 180
  const dLat = (targetLat - lat) * rad
  const dLon = (targetLon - lon) * rad
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(targetLat * rad) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)))
}


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
    if (action === 'geofence') {
      const boundary = await getCampusBoundary(supabase)
      if (!boundary) return NextResponse.json({ error: 'Campus location settings are unavailable.' }, { status: 503 })
      return NextResponse.json({ boundary }, { headers: { 'Cache-Control': 'no-store' } })
    }
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


// The client-facing registration route intentionally does not reuse the legacy
// submit endpoint's phone-based visitor identity, which could overwrite a
// different person's face photo when a number is reused or impersonated.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin request denied.' }, { status: 403 })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Registration is unavailable.' }, { status: 503 })
  }
  try {
    const rawBody = await request.text()
    if (rawBody.length > 800_000) {
      return NextResponse.json({ error: 'Registration photo is too large.' }, { status: 413 })
    }
    const body = JSON.parse(rawBody)
    if (body?.action !== 'register') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : ''
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
    const destinationId = body.destinationId
    const visitorType = body.visitorType
    if (body.privacyConsent !== true || fullName.length < 3 || fullName.length > 100 ||
        !/^09[0-9]{9}$/.test(contactNumber) || !['Parent', 'Alumni', 'Guest', 'Supplier', 'Government', 'Other'].includes(visitorType) ||
        purpose.length < 3 || purpose.length > 240 ||
        typeof destinationId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(destinationId)) {
      return NextResponse.json({ error: 'Invalid registration or missing privacy acknowledgement.' }, { status: 400 })
    }
    const facePhoto = body.facePhoto
    if (typeof facePhoto !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(facePhoto)) {
      return NextResponse.json({ error: 'A valid JPEG face photo is required.' }, { status: 400 })
    }
    const encoded = facePhoto.slice('data:image/jpeg;base64,'.length)
    if (encoded.length > 700_000) {
      return NextResponse.json({ error: 'Photo exceeds size limit.' }, { status: 413 })
    }
    const photoBuffer = Buffer.from(encoded, 'base64')
    if (photoBuffer.length < 100 || photoBuffer.length > 512_000 ||
        photoBuffer[0] !== 0xff || photoBuffer[1] !== 0xd8 || photoBuffer[2] !== 0xff) {
      return NextResponse.json({ error: 'Invalid JPEG photo.' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: destination, error: destError } = await supabase.from('destinations')
      .select('id').eq('id', destinationId).eq('active', true).maybeSingle()
    if (destError) return NextResponse.json({ error: 'Could not validate destination.' }, { status: 500 })
    if (!destination) return NextResponse.json({ error: 'Destination is unavailable.' }, { status: 400 })

    // The original registration flow checked the campus boundary before issuing a QR.
    // Re-check reported coordinates on the server instead of trusting a client distance/status.
    // Device GPS is not tamper-proof; a guard must still visually review the visitor.
    const boundary = await getCampusBoundary(supabase)
    if (!boundary) return NextResponse.json({ error: 'Campus location settings are unavailable.' }, { status: 503 })
    const gps = body.gpsReading
    const latitude = gps?.latitude
    const longitude = gps?.longitude
    const accuracy = gps?.accuracy
    const captured = typeof gps?.capturedAt === 'string' ? Date.parse(gps.capturedAt) : NaN
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !isCoordinate(latitude, longitude) ||
        typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 150 ||
        !Number.isFinite(captured) || Math.abs(Date.now() - captured) > 60_000) {
      return NextResponse.json({ error: 'A recent, accurate campus location reading is required.' }, { status: 422 })
    }
    const distance = campusDistance(latitude, longitude, boundary.latitude, boundary.longitude)
    if (distance > boundary.radius) {
      return NextResponse.json({ error: 'Registration requires being within the school check-in area.' }, { status: 403 })
    }

    const { data: visitor, error: visitorError } = await supabase.from('visitors')
      .insert({ full_name: fullName, contact_number: contactNumber, visitor_type: visitorType })
      .select('id').single()
    if (visitorError || !visitor) {
      return NextResponse.json({ error: 'Could not register visitor.' }, { status: 500 })
    }

    const facePath = `${visitor.id}/${Date.now()}-${randomBytes(4).toString('hex')}.jpg`
    const { error: photoError } = await supabase.storage.from('visitor-faces')
      .upload(facePath, photoBuffer, { contentType: 'image/jpeg', upsert: false })
    if (photoError) {
      await supabase.from('visitors').delete().eq('id', visitor.id)
      return NextResponse.json({ error: 'Could not save visitor photo.' }, { status: 500 })
    }
    const { error: faceLinkError } = await supabase.from('visitors')
      .update({ face_reference_path: facePath }).eq('id', visitor.id)
    if (faceLinkError) {
      await supabase.storage.from('visitor-faces').remove([facePath])
      await supabase.from('visitors').delete().eq('id', visitor.id)
      return NextResponse.json({ error: 'Could not link visitor photo.' }, { status: 500 })
    }

    // The reference fits the existing varchar(10) schema.
    const referenceNumber = 'V-' + randomBytes(4).toString('hex').toUpperCase()
    const token = randomBytes(16).toString('hex')
    const { data: visit, error: visitError } = await supabase.from('visits')
      .insert({
        visitor_id: visitor.id,
        destination_id: destinationId,
        reference_number: referenceNumber,
        purpose,
        status: 'PENDING',
        registration_time: new Date().toISOString(),
        public_token: token,
      })
      .select('id').single()
    if (visitError || !visit) {
      await supabase.storage.from('visitor-faces').remove([facePath])
      await supabase.from('visitors').delete().eq('id', visitor.id)
      return NextResponse.json({ error: 'Could not create visit.' }, { status: 500 })
    }
    // Record the device-reported check. An enrollment photo is not biometric verification.
    const { error: verificationError } = await supabase.from('verification_logs').insert({
      visit_id: visit.id,
      face_status: 'FACE_ENROLLED',
      gps_status: 'GPS_VERIFIED',
      gps_accuracy: accuracy,
      distance_from_school: Math.round(distance),
      latitude,
      longitude,
    })
    if (verificationError) {
      await supabase.from('visits').delete().eq('id', visit.id)
      await supabase.storage.from('visitor-faces').remove([facePath])
      await supabase.from('visitors').delete().eq('id', visitor.id)
      return NextResponse.json({ error: 'Could not save campus verification.' }, { status: 500 })
    }
    return NextResponse.json({ success: true, token, referenceNumber }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Invalid registration request.' }, { status: 400 })
  }
}
