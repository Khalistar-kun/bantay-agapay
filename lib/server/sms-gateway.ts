/** Send SMS only through a separately configured school-approved HTTPS gateway.
 * The adapter never logs phone numbers or verification codes.
 */
export function smsGatewayConfigured():boolean{
 return Boolean(process.env.BA_SMS_GATEWAY_URL&&process.env.BA_SMS_GATEWAY_SECRET&&
   process.env.BA_SMS_GATEWAY_SECRET.length>=24)
}
function gatewayUrl(value:string):URL|null{
 try{
   const target=new URL(value)
   const host=target.hostname.toLowerCase()
   if(target.protocol!=='https:'||target.username||target.password||target.port&&target.port!=='443'||
      !host.includes('.')||host==='localhost'||host.endsWith('.local')||
      host.endsWith('.internal')||host.endsWith('.localhost')||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)||host.includes(':'))
     return null
   return target
 }catch{return null}
}
export async function sendReturningOtp(phone:string,code:string):Promise<boolean>{
 const endpoint=gatewayUrl(process.env.BA_SMS_GATEWAY_URL||'')
 const secret=process.env.BA_SMS_GATEWAY_SECRET||''
 if(!endpoint||secret.length<24||!/^09\d{9}$/.test(phone)||!/^\d{6}$/.test(code))
   return false
 try{
   const response=await fetch(endpoint.toString(),{
     method:'POST',redirect:'error',cache:'no-store',
     headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},
     body:JSON.stringify({
       to:'+63'+phone.slice(1),
       message:'Bantay-Agapay verification code: '+code+'. Expires in 5 minutes. Never share it.'
     }),
     signal:AbortSignal.timeout(6500)
   })
   return response.ok
 }catch{return false}
}
