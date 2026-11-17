"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"

export function QRCheckoutScanner({
  onCheckedOut,onClose,
}:{
  onCheckedOut:(visitorName:string)=>void
  onClose:()=>void
}){
  const videoRef=useRef<HTMLVideoElement>(null)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const pausedRef=useRef(false)
  const [error,setError]=useState("")
  const [processing,setProcessing]=useState(false)
  const [scannedToken,setScannedToken]=useState("")
  const [visitorPreview,setVisitorPreview]=useState<{visitorName:string;reference:string}|null>(null)

  useEffect(()=>{
    let active=true
    let stream:MediaStream|null=null
    let rafId=0
    const scan=()=>{
      if(!active)return
      const video=videoRef.current,canvas=canvasRef.current
      if(!pausedRef.current&&video&&canvas&&video.readyState>=2&&video.videoWidth>0){
        const ctx=canvas.getContext("2d",{willReadFrequently:true})
        if(ctx){
          const scale=Math.min(1,700/video.videoWidth)
          canvas.width=Math.round(video.videoWidth*scale)
          canvas.height=Math.round(video.videoHeight*scale)
          ctx.drawImage(video,0,0,canvas.width,canvas.height)
          const image=ctx.getImageData(0,0,canvas.width,canvas.height)
          const read=jsQR(image.data,image.width,image.height,{inversionAttempts:"dontInvert"})
          const token=read?.data.trim()||""
          if(token){
            if(!/^[a-f0-9]{32}$/i.test(token)){
              setError("This is not a Bantay-Agapay QR pass. Scan the visitor's valid pass.")
            }else{
              pausedRef.current=true
              void prepareCheckout(token)
            }
          }
        }
      }
      rafId=requestAnimationFrame(scan)
    }
    const start=async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw Error("Camera is unavailable on this device.")
        const camera=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:"environment"}},audio:false
        })
        if(!active){camera.getTracks().forEach(t=>t.stop());return}
        stream=camera
        const video=videoRef.current
        if(video){video.srcObject=camera;await video.play();rafId=requestAnimationFrame(scan)}
      }catch{
        if(active)setError("Camera permission is unavailable. Use the main Gate QR Scanner for manual entry.")
      }
    }
    void start()
    return()=>{
      active=false;cancelAnimationFrame(rafId)
      stream?.getTracks().forEach(t=>t.stop())
      pausedRef.current=false
    }
  },[])

  const reset=()=>{
    pausedRef.current=false
    setScannedToken("")
    setVisitorPreview(null)
    setProcessing(false)
    setError("")
  }
  async function prepareCheckout(token:string){
    setScannedToken(token)
    setVisitorPreview(null)
    setProcessing(true)
    setError("")
    try{
      const response=await fetch("/api/security/checkout-preview?token="+encodeURIComponent(token),{
        cache:"no-store",credentials:"same-origin"
      })
      const body=await response.json()
      if(!response.ok||!body.eligible)throw Error(body.error||"Cannot verify checked-in visitor")
      setVisitorPreview({visitorName:body.visitorName,reference:body.reference})
    }catch(e){
      setError(e instanceof Error?e.message:"Visitor checkout identity is unavailable. Scan again.")
    }finally{setProcessing(false)}
  }
  async function confirmCheckout(){
    if(processing||!scannedToken||!visitorPreview)return
    setProcessing(true);setError("")
    try{
      const res=await fetch("/api/visit/checkout",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token:scannedToken})
      })
      const result=await res.json()
      if(!res.ok)throw Error(result.error||"The visit could not be checked out")
      onCheckedOut(result.visitorName||"Visitor")
    }catch(e){
      setError(e instanceof Error?e.message:"Checkout failed. Check the connection and retry.")
      setProcessing(false)
    }
  }

  return <div role="dialog" aria-modal="true" aria-label="Visitor QR checkout"
    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 sm:p-4">
    <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
      <div><h2 className="text-xl font-bold text-[#82172a]">Visitor Exit Verification</h2>
        <p className="mt-1 text-sm text-gray-600">
          Scan the visitor's QR, verify the person in front of you, then explicitly confirm their exit.
        </p>
      </div>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-gray-900">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
        {processing&&<div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-bold text-white">
          {visitorPreview?"Recording departure…":"Checking visitor identity…"}
        </div>}
      </div>
      <canvas ref={canvasRef} className="hidden"/>
      {scannedToken?<section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-bold text-amber-950">QR detected · Confirmation required</h3>
        {visitorPreview?<div className="rounded-lg bg-white p-3">
          <p className="text-xs font-bold uppercase text-gray-500">Checked-in visitor</p>
          <strong className="mt-1 block break-words text-base text-[#82172a]">{visitorPreview.visitorName}</strong>
          <p className="mt-1 text-sm text-gray-700">Reference: {visitorPreview.reference}</p>
        </div>:<p className="text-sm text-amber-950">Verifying active QR ending in ••••{scannedToken.slice(-6).toUpperCase()}…</p>}
        <p className="text-sm text-amber-950">
          Compare the visitor in front of you with this school record, and confirm they are physically leaving.
          This QR never authorizes a student's release.
        </p>
        <button type="button" disabled={processing||!visitorPreview} onClick={()=>void confirmCheckout()
          className="w-full rounded-xl bg-[#82172a] px-4 py-3 font-bold text-white disabled:opacity-50">
          Confirm Visitor Exit & Record Checkout
        </button>
        <button type="button" disabled={processing} onClick={reset}
          className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-950 disabled:opacity-50">
          Scan a Different QR
        </button>
      </section>:<p role="status" className="text-center text-xs text-gray-600">Camera is looking for a 32-character school visit QR.</p>}
      <button type="button" disabled={processing} onClick={onClose}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700 disabled:opacity-50">
        Cancel & Return to Security
      </button>
    </div>
  </div>
}
