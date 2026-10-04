// Integration check against the existing database. Creates only a temporary
// staff session, removed in finally; never creates or changes visitor records.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
const base = new URL(process.argv[2] || 'http://127.0.0.1:3000')
const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const token = crypto.randomBytes(32).toString('hex')
const call = (path, authenticated = false, init = {}) => fetch(new URL(path, base), {
  ...init,
  headers: { ...(authenticated ? { Cookie: `staff_session=${token}` } : {}), ...init.headers },
  signal: AbortSignal.timeout(20000),
})

try {
  const health = await call('/api/health')
  assert.equal(health.status, 200)
  assert.equal((await health.json()).database, 'connected')
  for (const path of ['/api/admin/stats', '/api/security/pending']) {
    const response = await call(path)
    assert.ok([401, 403].includes(response.status), `${path} must reject unauthenticated access`)
  }
  const { data: profiles, error: profileError } = await database.from('profiles').select('id')
    .eq('role', 'ADMIN').eq('active', true).eq('status', 'APPROVED').limit(1)
  assert.equal(profileError, null)
  assert.ok(profiles?.length, 'An active approved administrator is required')
  const { error: sessionError } = await database.from('staff_sessions').insert({
    token, profile_id: profiles[0].id, expires_at: new Date(Date.now() + 600000).toISOString(),
  })
  assert.equal(sessionError, null)
  const stats = await call('/api/admin/stats', true)
  assert.equal(stats.status, 200)
  const dashboard = await stats.json()
  const inside = await database.from('visits').select('id', { count: 'exact', head: true }).eq('status', 'INSIDE')
  assert.equal(inside.error, null)
  assert.equal(dashboard.currentlyInside, inside.count)
  const destinations = await call('/api/admin/destinations', true)
  assert.equal(destinations.status, 200)
  const actual = (await destinations.json()).destinations
  const expected = await database.from('destinations').select('id', { count: 'exact', head: true })
  assert.equal(expected.error, null)
  assert.equal(actual.length, expected.count)
  const pending = await call('/api/security/pending', true)
  assert.equal(pending.status, 200)
  const pendingRows = (await pending.json()).visitors
  const pendingCount = await database.from('visits').select('id', { count: 'exact', head: true }).eq('status', 'PENDING')
  assert.equal(pendingCount.error, null)
  assert.equal(pendingRows.length, pendingCount.count)
  const logout = await call('/api/auth/logout', true, { method: 'POST' })
  assert.equal(logout.status, 200)
  const afterLogout = await call('/api/admin/stats', true)
  assert.equal(afterLogout.status, 401)
  console.log(JSON.stringify({ health: 'connected', liveDestinations: actual.length, livePendingVisits: pendingRows.length, accessControls: 'passed', logout: 'passed' }))
} finally {
  const { error } = await database.from('staff_sessions').delete().eq('token', token)
  assert.equal(error, null, 'Temporary test session cleanup must succeed')
}
