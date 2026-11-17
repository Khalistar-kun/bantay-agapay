import { NextResponse } from "next/server"
import { requireStaff,schoolDb,noStore } from "@/lib/server/client-compliance-db"
import { GATE_KEY,availableRoute,point,readGate,readRoute,routeKey } from "@/lib/wayfinding"

export const dynamic="force-dynamic"

export async function GET(){
  // Security and admin personnel can view approved routes; only administrators
  // can edit the authoritative campus map or publish walkway instructions.
  const staff=await requireStaff()
  if(!staff)return NextResponse.json({error:"Approved staff login required"},{status:401,headers:noStore})
  try{
    const db=schoolDb()
    const {data:destinations,error:destError}=await db.from("destinations")
      .select("id,name,building,floor,room,map_x,map_y")
      .eq("active",true).order("name").limit(150)
    if(destError)throw Error("Destination data unavailable")
    const keys=[GATE_KEY,...(destinations||[]).map(d=>routeKey(d.id))]
    const {data:settings,error:settingsError}=await db.from("system_settings")
      .select("key,value").in("key",keys)
    if(settingsError)throw Error("Approved walking route data unavailable")
    const config=new Map((settings||[]).map(row=>[row.key,row.value as string]))
    const gate=readGate(config.get(GATE_KEY))
    const locations=(destinations||[]).map(d=>{
      const pin=d.map_x===null||d.map_y===null?null:
        point({x:Number(d.map_x),y:Number(d.map_y)})
      const route=availableRoute(readRoute(config.get(routeKey(d.id))),gate,pin)
      return{
        id:d.id,name:d.name,building:d.building,floor:d.floor,room:d.room,
        pin,route:route?{points:route.points,instructions:route.instructions}:null
      }
    })
    return NextResponse.json({gate,destinations:locations,
      notice:"Only approved, published campus paths are visible. Do not direct visitors through unapproved areas."},
      {headers:noStore})
  }catch{return NextResponse.json({error:"Campus walking routes are temporarily unavailable. Contact school administration."},{status:503,headers:noStore})}
}
