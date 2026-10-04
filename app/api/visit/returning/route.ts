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
  return `R-${randomLetter}-${randomNum}`
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
    const { phoneNumber, destinationId, purpose, facePhoto, gpsReading } = await request.json()

    if (!phoneNumber || !destinationId || !purpose) {
      return NextResponse.json({ error: "Phone number, destination, and purpose are required" }, { status: 400 })
    }

    if (!facePhoto) {
      return NextResponse.json({ error: "Face verification is required to re-enter campus" }, { status: 400 })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(destinationId)) {
      return NextResponse.json({ error: "Invalid destination selected" }, { status: 400 })
    }

    const normalized = normalizePhone(phoneNumber)

    const { data: visitor, error: searchError } = await supabase
      .from("visitors")
      .select("id, full_name")
      .eq("contact_number", normalized)
      .single()

    if (searchError || !visitor) {
      return NextResponse.json(
        { error: "Phone number not found. Please register as a new visitor." },
        { status: 404 }
      )
    }

    const facePath = await uploadFacePhoto(visitor.id, facePhoto)
    if (facePath) {
      await supabase.from("visitors").update({ face_reference_path: facePath }).eq("id", visitor.id)
    }

    const referenceNumber = generateReferenceNumber()
    const token = crypto.randomBytes(16).toString("hex")

    const { data: visitData, error } = await supabase
      .from("visits")
      .insert({
        visitor_id: visitor.id,
        destination_id: destinationId,
        reference_number: referenceNumber,
        purpose,
        public_token: token,
        status: "PENDING",
      })
      .select("id")
      .single()

    if (error || !visitData) {
      console.error("Returning visit insert error:", error)
      return NextResponse.json({ error: "Failed to create visit" }, { status: 500 })
    }

    if (gpsReading) {
      const { error: logError } = await supabase.from("verification_logs").insert({
        visit_id: visitData.id,
        face_status: "FACE_VERIFIED",
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

    return NextResponse.json({ visitId: visitData.id, token, visitorName: visitor.full_name })
  } catch (err) {
    console.error("Returning visitor error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
