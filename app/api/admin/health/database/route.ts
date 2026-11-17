import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyStaff } from "@/lib/auth/verifyStaff"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const headers = { "Cache-Control": "no-store, max-age=0" }
type State = "connected" | "unavailable" | "not_configured"
type Readiness = {
  registration:{configured:boolean;missing:string[]};
  sms:{configured:boolean;missing:string[]};
  guardianFaceComparison:{configured:boolean;missing:string[]};
  notice:string
}
function configurationReadiness():Readiness{
  const registrationMissing:string[]=[]
  const smsMissing:string[]=[]
  const faceMissing:string[]=[]
  const present=(key:string,min:number)=>Boolean((process.env[key]||"").length>=min)
  if(!present("BA_RATE_LIMIT_SECRET",32))registrationMissing.push("BA_RATE_LIMIT_SECRET")
  if(!present("BA_OTP_HMAC_SECRET",32))registrationMissing.push("BA_OTP_HMAC_SECRET")
  if(!present("BA_OTP_HMAC_SECRET",32))smsMissing.push("BA_OTP_HMAC_SECRET")
  if(!present("TEXTBEE_API_KEY",24))smsMissing.push("TEXTBEE_API_KEY")
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(process.env.TEXTBEE_DEVICE_ID||""))smsMissing.push("TEXTBEE_DEVICE_ID")
  if(process.env.BA_FREE_SMS_ONLY!=="true")smsMissing.push("BA_FREE_SMS_ONLY=true")
  if(process.env.BA_SMS_CARRIER_INCLUDED!=="true")smsMissing.push("BA_SMS_CARRIER_INCLUDED=true (school carrier confirmation)")
  const faceURL=process.env.BA_FACE_COMPARISON_URL||""
  if(!/^https:\/\//.test(faceURL))faceMissing.push("BA_FACE_COMPARISON_URL")
  if(!present("BA_FACE_COMPARISON_SECRET",24))faceMissing.push("BA_FACE_COMPARISON_SECRET")
  const threshold=Number(process.env.BA_FACE_MIN_CONFIDENCE)
  if(!process.env.BA_FACE_MIN_CONFIDENCE||!Number.isFinite(threshold)||threshold<=0||threshold>1)
    faceMissing.push("BA_FACE_MIN_CONFIDENCE")
  return {
    registration:{configured:registrationMissing.length===0&&smsMissing.length===0,
      missing:[...new Set([...registrationMissing,...smsMissing])]},
    sms:{configured:smsMissing.length===0,missing:smsMissing},
    guardianFaceComparison:{configured:faceMissing.length===0,missing:faceMissing},
    notice:"Configuration checks are NOT SMS delivery tests, live biometric verification, rate-limit RPC execution, or proof of successful registration."
  }
}

export async function GET() {
  // Do not disclose DB configuration or connectivity to unauthenticated visitors.
  let staff: Awaited<ReturnType<typeof verifyStaff>>
  try {
    staff = await verifyStaff()
  } catch {
    return NextResponse.json({ error: "Administrator authentication unavailable" }, { status: 503, headers })
  }
  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403, headers })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const result: { status: State; database: State; checks: Record<string, State>; checkedAt: string; readiness: Readiness } = {
    status: "unavailable",
    database: "unavailable",
    checks: { connectivity: "unavailable", registrationRateLimits: "unavailable", guardianRegistry: "unavailable" },
    checkedAt: new Date().toISOString(),
    readiness:configurationReadiness(),
  }

  if (!url || !serviceKey || !/^https:\/\//.test(url)) {
    result.status = "not_configured"
    result.database = "not_configured"
    result.checks = { connectivity: "not_configured", registrationRateLimits: "not_configured", guardianRegistry: "not_configured" }
    return NextResponse.json(result, { status: 503, headers })
  }

  try {
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(6000) }) },
    })
    // Read-only, zero-row queries; no visitor data, secrets, or counts returned.
    const checks = await Promise.all([
      db.from("destinations").select("id", { head: true }).limit(0),
      db.from("auth_rate_limits").select("key_hash", { head: true }).limit(0),
      db.from("authorized_guardians").select("id", { head: true }).limit(0),
      db.from("visitor_phone_verifications").select("proof_hash", { head: true }).limit(0),
    ])
    result.checks = {
      connectivity: checks[0].error ? "unavailable" : "connected",
      registrationRateLimits: checks[1].error ? "unavailable" : "connected",
      guardianRegistry: checks[2].error ? "unavailable" : "connected",
      phoneVerificationProofs: checks[3].error ? "unavailable" : "connected",
    }
    result.status = checks.every(x => !x.error) ? "connected" : "unavailable"
    result.database = result.checks.connectivity
    return NextResponse.json(result, { status: result.status === "connected" ? 200 : 503, headers })
  } catch {
    return NextResponse.json(result, { status: 503, headers })
  }
}
