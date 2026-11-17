import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

// This route is retired to prevent old visits bypassing guardian authorization.
// Existing visitors who are INSIDE can still be checked out at the gate safely.
export async function POST(request:NextRequest){
  const staff=await verifyStaff()
  if(!staff)return NextResponse.json({error:"Staff login required"},{status:401})
  const origin=request.headers.get("origin")
  if(origin&&origin!==request.nextUrl.origin)
    return NextResponse.json({error:"Cross-origin request denied"},{status:403})
  return NextResponse.json({
    error:"Legacy entry approval has been retired. Ask the visitor to re-register and use /security/gate for identity verification."
  },{status:410})
}
