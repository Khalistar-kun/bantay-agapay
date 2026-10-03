import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, password } = await request.json()

    // Normalize phone: remove all non-digits
    const normalizedPhone = phoneNumber.replace(/\D/g, "")

    // Security staff: 0917123456 or 917123456
    if ((normalizedPhone === "09171234567" || normalizedPhone === "9171234567" || normalizedPhone === "0917123456") && password === "sec1234") {
      const response = NextResponse.json(
        { success: true, role: "SECURITY", phoneNumber },
        { status: 200 }
      )
      response.cookies.set("auth_token", "security_token_123", { httpOnly: true, maxAge: 86400 })
      return response
    }

    // Admin staff: 0918987654 or 918987654
    if ((normalizedPhone === "09189876543" || normalizedPhone === "9189876543" || normalizedPhone === "0918987654") && password === "admin1234") {
      const response = NextResponse.json(
        { success: true, role: "ADMIN", phoneNumber },
        { status: 200 }
      )
      response.cookies.set("auth_token", "admin_token_123", { httpOnly: true, maxAge: 86400 })
      return response
    }

    return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
