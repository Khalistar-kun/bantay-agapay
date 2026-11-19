export type LocationState='SHARING_ACTIVE'|'DELAYED'|'STALE'|'NOT_SHARED'|'LOW_ACCURACY'|'WAITING_FOR_GPS'
export type LocationReading={
  location_sharing_enabled:boolean|null;
  current_latitude:number|null;current_longitude:number|null;
  location_accuracy_m:number|null;location_updated_at:string|null
}
export function visitorLocationPresence(row:LocationReading,now=Date.now()){
  const empty={current_latitude:null as number|null,current_longitude:null as number|null,
    location_accuracy_m:null as number|null,location_updated_at:null as string|null,
    location_age_seconds:null as number|null}
  if(row.location_sharing_enabled!==true)return{...empty,location_status:'NOT_SHARED' as LocationState}
  const lat=Number(row.current_latitude),lng=Number(row.current_longitude)
  const accuracy=Number(row.location_accuracy_m)
  const timestamp=row.location_updated_at?Date.parse(row.location_updated_at):NaN
  if(!row.location_updated_at||!Number.isFinite(timestamp))
    return{...empty,location_status:'WAITING_FOR_GPS' as LocationState}
  const age=Math.max(0,Math.floor((now-timestamp)/1000))
  if(age>120||timestamp>now+5000)
    return{...empty,location_status:'STALE' as LocationState,
      location_age_seconds:age,location_updated_at:row.location_updated_at}
  if(row.current_latitude===null||row.current_longitude===null||
    row.location_accuracy_m===null||!Number.isFinite(lat)||!Number.isFinite(lng)||
    !Number.isFinite(accuracy)||Math.abs(lat)>90||Math.abs(lng)>180||
    accuracy<1||accuracy>150)
    return{...empty,location_status:'LOW_ACCURACY' as LocationState,
      location_age_seconds:age,location_updated_at:row.location_updated_at}
  return{
    current_latitude:lat,current_longitude:lng,
    location_accuracy_m:Math.round(accuracy),location_updated_at:row.location_updated_at,
    location_age_seconds:age,location_status:(age<=45?'SHARING_ACTIVE':'DELAYED') as LocationState
  }
}
