import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { normalizePhone } from "@/lib/utils/phone"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

function generateReferenceNumber(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const randomLetter = letters[Math.floor(Math.random() * letters.length)]
  const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, "0")
  return `${randomLetter}-${randomNum}`
}

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex")
}

async function uploadFacePhoto(visitorId: string, facePhoto: string): Promise<string | null> {
  try {
    const matches = facePhoto.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) return null

    const ext = matches[1] === "jpeg" ? "jpg" : matches[1]
    const buffer = Buffer.from(matches[2], "base64")
    const path = `${visitorId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from("visitor-faces").upload(path, buffer, {
      contentType: `image/${matches[1]}`,
      upsert: false,
    })

    if (error) {
      console.error("Face photo upload error:", error)
      return null
    }

    return path
  } catch (error) {
    console.error("Face photo upload exception:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fullName, contactNumber, visitorType, purpose, destinationId, facePhoto, gpsReading } = body

    if (!fullName || !contactNumber || !visitorType || !purpose || !destinationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(destinationId)) {
      return NextResponse.json(
        { error: "Invalid destination selected. Please refresh the page and select a destination again." },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhone(contactNumber)

    // Create or find visitor by phone number (phone is the stable identity, not name+phone)
    const { data: existingVisitor, error: searchError } = await supabase
      .from("visitors")
      .select("id")
      .eq("contact_number", normalizedPhone)
      .single()

    let visitorId: string

    if (searchError && searchError.code === "PGRST116") {
      // Visitor doesn't exist, create new
      const { data: newVisitor, error: createError } = await supabase
        .from("visitors")
        .insert({ full_name: fullName, contact_number: normalizedPhone, visitor_type: visitorType })
        .select("id")
        .single()

      if (createError || !newVisitor) {
        return NextResponse.json({ error: "Failed to create visitor record" }, { status: 500 })
      }

      visitorId = newVisitor.id
    } else if (existingVisitor) {
      visitorId = existingVisitor.id
    } else {
      return NextResponse.json({ error: "Unable to process visitor record" }, { status: 500 })
    }

    if (facePhoto) {
      const facePath = await uploadFacePhoto(visitorId, facePhoto)
      if (facePath) {
        await supabase.from("visitors").update({ face_reference_path: facePath }).eq("id", visitorId)
      }
    }

    // Create visit record
    const referenceNumber = generateReferenceNumber()
    const token = generateToken()

    const { data: newVisit, error: visitError } = await supabase
      .from("visits")
      .insert({
        visitor_id: visitorId,
        destination_id: destinationId,
        reference_number: referenceNumber,
        purpose: purpose,
        status: "PENDING",
        registration_time: new Date().toISOString(),
        public_token: token,
      })
      .select("id")
      .single()

    if (visitError || !newVisit) {
      console.error("Visit insert error:", visitError)
      return NextResponse.json({ error: `Failed to create visit record: ${visitError?.message}` }, { status: 500 })
    }

    if (gpsReading) {
      const { error: logError } = await supabase.from("verification_logs").insert({
        visit_id: newVisit.id,
        face_status: facePhoto ? "FACE_VERIFIED" : "FACE_DETECTION_FAILED",
        gps_status: "GPS_VERIFIED",
        gps_accuracy: gpsReading.accuracy ?? null,
        distance_from_school: gpsReading.distance ?? null,
        latitude: gpsReading.latitude ?? null,
        longitude: gpsReading.longitude ?? null,
      })

      if (logError) {
        console.error("Verification log insert error:", logError)
      }
    }

    return NextResponse.json({
      token,
      referenceNumber,
      success: true,
    })
  } catch (error) {
    console.error("Visit submission error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
