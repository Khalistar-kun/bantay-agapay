/**
 * Approved, externally hosted one-to-one guardian face comparison.
 *
 * No library-provided motion check proves liveness. This adapter only accepts
 * a separately contracted, school-approved provider that explicitly attests
 * to liveness and comparison quality. Without its configuration, it FAILS CLOSED.
 *
 * HTTPS POST contract (private school service):
 * Request: {version:"1",probeImageBase64,referenceImageBase64}
 * Response: {matched:boolean,confidence:number,livenessVerified:boolean,modelVersion:string}
 * No images are retained by this adapter or written to logs.
 */
export type FaceComparison={
  status:'MATCH'|'NO_MATCH'|'ERROR'
  confidence:number|null
  modelVersion:string|null
}
function trustedProvider(url:string):URL|null {
  try{
    const endpoint=new URL(url)
    const host=endpoint.hostname.toLowerCase()
    if(endpoint.protocol!=='https:' || endpoint.username||endpoint.password||
      host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||
      host.endsWith('.localhost')||/^\d{1,3}(\.\d{1,3}){3}$/.test(host)||
      host.includes(':')||!host.includes('.')||endpoint.port&&endpoint.port!=='443')return null
    return endpoint
  }catch{return null}
}
export async function compareEnrolledFaces(live:Buffer,reference:Buffer):Promise<FaceComparison> {
  const refused:FaceComparison={status:'ERROR',confidence:null,modelVersion:null}
  if(live.length<100||live.length>1_000_000||reference.length<100||reference.length>1_000_000)
    return refused
  const url=process.env.BA_FACE_COMPARISON_URL||''
  const secret=process.env.BA_FACE_COMPARISON_SECRET||''
  const thresholdRaw=process.env.BA_FACE_MIN_CONFIDENCE||''
  const threshold=Number(thresholdRaw)
  const endpoint=trustedProvider(url)
  if(!endpoint||secret.length<24||!thresholdRaw||!Number.isFinite(threshold)||
    threshold<0.9||threshold>0.9999)return refused
  try{
    const response=await fetch(endpoint.toString(),{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+secret,'Cache-Control':'no-store'},
      body:JSON.stringify({
        version:'1',
        probeImageBase64:live.toString('base64'),
        referenceImageBase64:reference.toString('base64'),
      }),
      signal:AbortSignal.timeout(8500),
      cache:'no-store',
      redirect:'error'
    })
    if(!response.ok||Number(response.headers.get('content-length')||0)>4096)return refused
    const data:unknown=await response.json()
    if(!data||typeof data!=='object')return refused
    const result=data as Record<string,unknown>
    if(typeof result.matched!=='boolean'||typeof result.confidence!=='number'||
      !Number.isFinite(result.confidence)||result.confidence<0||result.confidence>1||
      result.livenessVerified!==true||typeof result.modelVersion!=='string'||
      result.modelVersion.length<2||result.modelVersion.length>120)return refused
    // Never accept provider's "matched" alone: require explicit calibrated
    // score and independent liveness statement before matching.
    return {
      status:result.matched&&result.confidence>=threshold?'MATCH':'NO_MATCH',
      confidence:result.confidence,
      modelVersion:result.modelVersion
    }
  }catch{return refused}
}
