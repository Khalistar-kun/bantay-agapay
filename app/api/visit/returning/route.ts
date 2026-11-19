import { NextResponse } from "next/server"
// Legacy identity and GPS-bypassing registration is intentionally retired.
// Registration is now pre-registration from home; guardian authorization is checked at the gate.
export async function POST(){
  return NextResponse.json({error:"This registration process has been replaced. Use /pre-register."},{status:410})
}
