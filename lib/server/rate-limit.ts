import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { schoolDb } from '@/lib/server/client-compliance-db'

/** DB-backed bounded rate limiter. Requires server-only HMAC secret.
 * Public browser code cannot call the RPC or inspect identity keys.
 * Fails closed if a school has not configured the secret or migrated its DB.
 */
export async function consumeRateLimit(
  req:NextRequest,
  scope:string,
  subject:string,
  limit:number,
  windowSeconds:number
):Promise<boolean>{
  const secret=process.env.BA_RATE_LIMIT_SECRET||''
  if(secret.length<32)throw Error('Security rate limiting not configured')
  // X-Vercel-Forwarded-For is supplied by Vercel edge if available. Avoid
  // storing raw IP or full identity in the database.
  const forwarded=(req.headers.get('x-vercel-forwarded-for')||
    req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')||'unknown')
    .split(',')[0].trim().slice(0,90)
  const data=[scope,forwarded,subject.slice(0,150)].join('|')
  const key=crypto.createHmac('sha256',secret).update(data).digest('hex')
  const {data:ok,error}=await schoolDb().rpc('consume_rate_limit',{
    p_key_hash:key,p_limit:limit,p_window_seconds:windowSeconds
  })
  if(error||typeof ok!=='boolean')throw Error('Rate-limit verification unavailable')
  return ok
}
