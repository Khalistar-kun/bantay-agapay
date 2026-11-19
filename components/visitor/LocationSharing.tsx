"use client"

import {useCallback,useEffect,useRef,useState} from "react"

type Status={available:boolean;sharing:boolean;accuracyMeters:number|null;updatedAt:string|null}
const maxAccuracy=150
const format=(time:string)=>new Date(time).toLocaleTimeString("en-PH",{timeZone:"Asia/Manila"})

export function LocationSharing({token}:{token:string}){
  const [permission,setPermission]=useState<"checking"|"allowed"|"denied">("checking")
  const [remoteSharing,setRemoteSharing]=useState(false)
  const [watching,setWatching]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [accuracy,setAccuracy]=useState<number|null>(null)
  const [updatedAt,setUpdatedAt]=useState<string|null>(null)
  const [pageVisible,setPageVisible]=useState(true)
  const watchId=useRef<number|null>(null)
  const timerId=useRef<ReturnType<typeof setInterval>|null>(null)
  const active=useRef(false)
  const inflight=useRef(false)
  const lastSent=useRef(0)

  const locationRequest=useCallback(async(body:Record<string,unknown>)=>{
    const res=await fetch("/api/visit/location",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({token,...body})
    })
    const data=await res.json()
    if(!res.ok)throw Object.assign(new Error(data.error||"Location request failed"),{status:res.status})
    return data
  },[token])

  const clearLocal=useCallback(()=>{
    active.current=false
    if(watchId.current!==null&&navigator.geolocation){
      navigator.geolocation.clearWatch(watchId.current);watchId.current=null
    }
    if(timerId.current!==null){clearInterval(timerId.current);timerId.current=null}
    setWatching(false)
  },[])

  useEffect(()=>{
    let alive=true
    setPageVisible(!document.hidden)
    fetch("/api/visit/location?token="+encodeURIComponent(token),{
      cache:"no-store",credentials:"same-origin"
    }).then(async r=>{
      const data=await r.json()
      if(!r.ok)throw new Error(data.error||"Location sharing unavailable")
      return data as Status
    }).then(data=>{
      if(!alive)return
      setPermission(data.available?"allowed":"denied")
      setRemoteSharing(data.sharing===true)
      setAccuracy(data.accuracyMeters)
      setUpdatedAt(data.updatedAt)
    }).catch(e=>{
      if(!alive)return
      setPermission("denied");setError(e instanceof Error?e.message:"Location sharing unavailable")
    })
    const visibility=()=>setPageVisible(!document.hidden)
    document.addEventListener("visibilitychange",visibility)
    return()=>{alive=false;clearLocal();document.removeEventListener("visibilitychange",visibility)}
  },[token,clearLocal])

  const stop=useCallback(async()=>{
    clearLocal();setBusy(true);setError("")
    try{
      const data=await locationRequest({action:"stop"})
      setRemoteSharing(false);setAccuracy(null);setUpdatedAt(null)
      setNotice(data.message||"Location sharing has stopped.")
    }catch(e){
      setError((e instanceof Error?e.message:"Could not stop sharing")+
        " The device stopped sending GPS. Retry stopping to clear the server's last shared position.")
    }finally{setBusy(false)}
  },[clearLocal,locationRequest])

  const onFix=useCallback((position:GeolocationPosition)=>{
    if(!active.current||document.hidden||inflight.current)return
    const {latitude,longitude,accuracy:meters}=position.coords
    const measuredAt=position.timestamp
    if(!Number.isFinite(meters)||meters<1||meters>maxAccuracy){
      setError("GPS accuracy is too low to share a reliable position. Move to an open area or ask a guard for directions.")
      return
    }
    if(Date.now()-measuredAt>30_000||measuredAt>Date.now()+5000){
      setError("The phone reported an old GPS reading. Waiting for a newer fix.")
      return
    }
    if(Date.now()-lastSent.current<20_000)return
    lastSent.current=Date.now()
    inflight.current=true
    void locationRequest({action:"update",latitude,longitude,accuracy:meters,measuredAt})
      .then(data=>{
        setAccuracy(data.accuracyMeters);setUpdatedAt(data.updatedAt)
        setNotice("Location received by school security.");setError("")
      }).catch(e=>{
        if((e as {status?:number}).status===409||(e as {status?:number}).status===403){
          clearLocal();setRemoteSharing(false)
        }
        setError(e instanceof Error?e.message:"GPS update could not reach school security.")
      }).finally(()=>{inflight.current=false})
  },[locationRequest,clearLocal])

  const beginWatch=useCallback(()=>{
    if(!navigator.geolocation||!active.current)return
    if(watchId.current!==null)navigator.geolocation.clearWatch(watchId.current)
    watchId.current=navigator.geolocation.watchPosition(onFix,(e)=>{
      const message=e.code===1?"Location permission was denied. Turn it on in browser settings or stop sharing.":
        e.code===3?"The phone GPS timed out. Try an open area.":"Phone GPS is currently unavailable."
      setError(message)
      if(e.code===1)void stop()
    },{enableHighAccuracy:true,timeout:15000,maximumAge:5000})
    if(timerId.current!==null)clearInterval(timerId.current)
    timerId.current=setInterval(()=>{
      if(!active.current||document.hidden||inflight.current||
        Date.now()-lastSent.current<45_000)return
      navigator.geolocation.getCurrentPosition(onFix,()=>setError(
        "No recent phone GPS reading. The guard may see your last position as stale."
      ),{enableHighAccuracy:true,timeout:12000,maximumAge:5000})
    },30000)
  },[onFix,stop])

  useEffect(()=>{
    if(!active.current||!navigator.geolocation)return
    if(!pageVisible){
      if(watchId.current!==null){navigator.geolocation.clearWatch(watchId.current);watchId.current=null}
      if(timerId.current!==null){clearInterval(timerId.current);timerId.current=null}
    }else beginWatch()
  },[pageVisible,beginWatch])

  async function start(){
    if(busy||watching)return
    setBusy(true);setError("");setNotice("")
    try{
      if(!window.isSecureContext||!navigator.geolocation)
        throw new Error("This device does not support secure browser geolocation.")
      // A deliberate tap triggers native browser permission. Reject poor readings
      // BEFORE switching the server consent flag on.
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>
        navigator.geolocation.getCurrentPosition(resolve,reject,{
          enableHighAccuracy:true,timeout:15000,maximumAge:0
        }))
      if(position.coords.accuracy>maxAccuracy)
        throw new Error("GPS accuracy is insufficient indoors. Try outdoors or use the campus directions.")
      await locationRequest({action:"start"})
      active.current=true;setRemoteSharing(true);setWatching(true)
      lastSent.current=0
      onFix(position)
      if(!document.hidden)beginWatch()
      setNotice("Location sharing enabled for this active campus visit. It pauses in the background.")
    }catch(e){
      const code=(e as GeolocationPositionError)?.code
      setError(code===1?"Location permission denied. You can still use the QR and campus map.":
        code===3?"GPS timed out. Try again near an open area.":
        e instanceof Error?e.message:"Could not obtain a location. Ask school security for assistance.")
    }finally{setBusy(false)}
  }

  if(permission==="checking")return <section className="mt-5 rounded-xl bg-white p-4 text-sm" role="status">
    Checking optional location sharing…
  </section>

  return <section aria-label="Optional location sharing" className="mt-5 rounded-2xl border border-[#ead2da] bg-[#fff8fa] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-lg font-extrabold text-[#82172a]">Optional Phone Location</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-700">
          Only approved on-duty security personnel can see a recent approximate position.
          This is not indoor room tracking or emergency monitoring. Phone GPS needs permission,
          HTTPS, a visible page and internet access. Your entry is never dependent on sharing.
        </p>
      </div>
      <span className={"rounded-full px-3 py-1 text-xs font-bold "+(watching?
        "bg-emerald-100 text-emerald-900":"bg-gray-100 text-gray-700")}>
        {watching?"Sharing while open":remoteSharing?"Paused / not updating":"Not sharing"}
      </span>
    </div>
    {permission==="denied"?<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      {error||"Tracking is available only from the browser used to verify and register this visitor."}
      {" "}Your QR pass and school directions still work.
    </p>:<>
      {updatedAt&&<p className="mt-3 text-sm text-gray-700">
        Last accepted location: <strong>{format(updatedAt)} PH</strong>
        {accuracy!==null?" · Approximate accuracy ±"+Math.round(accuracy)+" m":""}
      </p>}
      {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {notice&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      {!pageVisible&&<p className="mt-3 text-sm text-amber-800">Location updates pause while the page is in the background.</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={()=>void start()} disabled={busy||watching}
          className="flex-1 rounded-xl bg-[#82172a] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          {busy?"Processing…":remoteSharing?"Resume Location Sharing":"Start Sharing My Location"}
        </button>
        {remoteSharing&&<button type="button" disabled={busy} onClick={()=>void stop()}
          className="flex-1 rounded-xl border border-[#82172a] px-4 py-3 text-sm font-bold text-[#82172a] disabled:opacity-50">
          Stop & Clear My Location
        </button>}
      </div>
    </>}
    <p className="mt-3 text-xs text-gray-600">
      Showing a QR never shares GPS. Saving a QR does not enable tracking.
      Stop anytime or ask a security guard for help.
    </p>
  </section>
}
