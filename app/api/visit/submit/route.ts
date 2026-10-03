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
  return `${randomLetter}-${randomNum}`
}

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fullName, contactNumber, visitorType, purpose, destinationId } = body

    if (!fullName || !contactNumber || !visitorType || !purpose || !destinationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create or find visitor
    const { data: existingVisitor, error: searchError } = await supabase
      .from("visitors")
      .select("id")
      .eq("full_name", fullName)
      .eq("contact_number", contactNumber)
      .single()

    let visitorId: string

    if (searchError && searchError.code === "PGRST116") {
      // Visitor doesn't exist, create new
      const { data: newVisitor, error: createError } = await supabase
        .from("visitors")
        .insert({ full_name: fullName, contact_number: contactNumber, visitor_type: visitorType })
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

    // Create visit record
    const referenceNumber = generateReferenceNumber()
    const token = generateToken()

    const { error: visitError } = await supabase.from("visits").insert({
      visitor_id: visitorId,
      destination_id: destinationId,
      reference_number: referenceNumber,
      purpose: purpose,
      status: "PENDING",
      registration_time: new Date().toISOString(),
      public_token: token,
    })

    if (visitError) {
      return NextResponse.json({ error: "Failed to create visit record" }, { status: 500 })
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
