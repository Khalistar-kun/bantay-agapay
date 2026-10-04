import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST(request: NextRequest) {
  try {
    const staff = await verifyStaff()

    if (!staff || staff.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { latitude, longitude, radius, schoolName } = await request.json()

    if (!latitude || !longitude || !radius) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Save to system_settings table
    const settings = [
      { key: "school_latitude", value: latitude.toString() },
      { key: "school_longitude", value: longitude.toString() },
      { key: "geofence_radius", value: radius.toString() },
      { key: "school_name", value: schoolName || "AFGBMTS" },
    ]

    for (const setting of settings) {
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: setting.key, value: setting.value }, { onConflict: "key" })

      if (error) {
        console.error(`Error saving ${setting.key}:`, error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase.from("system_settings").select("*")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const settings: Record<string, string> = {}
    data?.forEach((item: any) => {
      settings[item.key] = item.value
    })

    return NextResponse.json({
      latitude: parseFloat(settings.school_latitude || "14.7370"),
      longitude: parseFloat(settings.school_longitude || "120.9728"),
      radius: parseInt(settings.geofence_radius || "500"),
      schoolName: settings.school_name || "AFGBMTS",
    })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
