import { NextRequest,NextResponse } from "next/server"
import { requireStaff,schoolDb,qrTokenPattern,noStore } from "@/lib/server/client-compliance-db"

export const dynamic="force-dynamic"

export async function GET(req:NextRequest){
  const staff=await requireStaff()
  if(!staff)return NextResponse.json({error:"Security login required"},{status:401,headers:noStore})
  const token=req.nextUrl.searchParams.get("token")||""
  if(!qrTokenPattern.test(token))
    return NextResponse.json({error:"Invalid school QR pass"},{status:400,headers:noStore})
  try{
    const {data:visit,error}=await schoolDb().from("visits")
      .select("id,reference_number,status,visitors(full_name)")
      .eq("public_token",token).eq("status","INSIDE").maybeSingle()
    if(error)throw Error("Visitor lookup unavailable")
    if(!visit)return NextResponse.json({
      error:"No active checked-in visitor matches this QR. The pass may be unused or already checked out."
    },{status:409,headers:noStore})
    const person=visit.visitors as unknown as {full_name:string}|null
    if(!person?.full_name||!visit.reference_number)
      return NextResponse.json({error:"Visitor identity record incomplete. Use the main gate review."},{status:503,headers:noStore})
    return NextResponse.json({
      eligible:true,visitorName:person.full_name,reference:visit.reference_number,
      notice:"Check the person's identity and actual departure before recording checkout. This is never a child-release authorization."
    },{headers:noStore})
  }catch{
    return NextResponse.json({error:"Active visitor verification is unavailable. Do not check out this pass."},{status:503,headers:noStore})
  }
}
