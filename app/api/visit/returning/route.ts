import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

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

export async function POST(request: NextRequest) {
  try {
    const { visitorId } = await request.json()

    if (!visitorId) {
      return NextResponse.json({ error: "Missing visitor ID" }, { status: 400 })
    }

    // Get a valid destination ID from database
    const { data: destinations } = await supabase
      .from("destinations")
      .select("id")
      .limit(1)

    const destinationId = destinations?.[0]?.id || "00000000-0000-0000-0000-000000000000"

    const referenceNumber = generateReferenceNumber()
    const token = crypto.randomBytes(16).toString("hex")

    const { data: visitData, error } = await (supabase
      .from("visits")
      .insert({
        visitor_id: visitorId,
        destination_id: destinationId,
        reference_number: referenceNumber,
        purpose: "Returning visitor re-entry",
        public_token: token,
        status: "PENDING",
      })
      .select("id") as any)

    if (error || !visitData || visitData.length === 0) {
      return NextResponse.json({ error: "Failed to create visit" }, { status: 500 })
    }

    return NextResponse.json({ visitId: visitData[0].id, token })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
