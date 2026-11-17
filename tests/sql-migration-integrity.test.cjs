const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const s=fs.readFileSync(path.join(__dirname,'../supabase/migrations/10_client_guardian_preregistration.sql'),'utf8')
function count(pattern){return(s.match(pattern)||[]).length}
test('migration uses one atomic transaction with exactly one commit',()=>{
  assert.match(s,/^BEGIN;\s*$/m)
  assert.equal(count(/^COMMIT;\s*$/gm),1)
  assert.ok(s.trim().endsWith('COMMIT;'))
})
test('each service-role RPC is created exactly once; dollar quote bodies balance',()=>{
  for(const name of ['consume_rate_limit','admit_pre_registration','checkout_pre_registration']){
    assert.equal(count(new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\s*\\(','g')),1)
  }
  for(const tag of ['$limiter$','$admission$','$checkout$'])
    assert.equal(s.split(tag).length-1,2,'unbalanced function delimiter '+tag)
})
test('rate-limit schema has a complete SHA-256 pattern and no fragments from previous corrupted migration',()=>{
  assert.match(s,/key_hash\s+varchar\(64\)\s+PRIMARY KEY\s+CHECK\s*\(key_hash\s*~\s*'\^\[a-f0-9\]\{64\}\$'\)/)
  assert.doesNotMatch(s,/COMMIT;\s*\),/)
  assert.doesNotMatch(s,/^AS \$$/m)
})
test('guardian eligibility is revalidated inside the locked database transaction',()=>{
  assert.match(s,/SELECT \* INTO pr FROM public\.pre_registrations WHERE id = p_id FOR UPDATE/)
  assert.match(s,/g\.active AND g\.verified_at IS NOT NULL/)
  assert.match(s,/sg\.active AND s\.active/)
  assert.match(s,/pr\.biometric_status <> 'MATCH'/)
  assert.match(s,/pr\.guardian_details_status <> 'MATCH'/)
  assert.match(s,/g\.birth_date = pr\.guardian_birth_date/)
  assert.match(s,/g\.contact_number = pr\.contact_number/)
})
test('private family records and credential counters have RLS and restricted database grants',()=>{
  for(const name of ['students','student_guardians','authorized_guardians','faculty_directory','pre_registrations','privacy_requests','auth_rate_limits'])
   assert.match(s,new RegExp('ALTER TABLE public\\.'+name+' ENABLE ROW LEVEL SECURITY;'))
  for(const name of ['consume_rate_limit','admit_pre_registration','checkout_pre_registration'])
   assert.match(s,new RegExp('REVOKE EXECUTE ON FUNCTION public\\.'+name+'\\([\\s\\S]*?FROM PUBLIC, anon, authenticated;'))
})
