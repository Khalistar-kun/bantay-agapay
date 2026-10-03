# Supabase Setup Guide for Bantay-Agapay

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - Organization: Select existing or create new
   - Project name: `bantay-agapay`
   - Database password: Create a strong password
   - Region: Select nearest to Philippines (or Singapore)
4. Click "Create new project"
5. Wait 2-3 minutes for initialization

## Step 2: Get Your Credentials

Once project is created:

1. Go to **Settings → API** (left sidebar)
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** (under "API Keys")
   - **service_role secret** (under "API Keys") - KEEP PRIVATE!

## Step 3: Create Database Schema

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy-paste the entire contents of: `supabase/migrations/00_initial_schema.sql`
4. Click "Run"
5. Wait for success message

You should see:
- ✅ 8 tables created
- ✅ Indexes created
- ✅ RLS policies created
- ✅ Sample destinations inserted (8 records)

## Step 4: Update Environment Variables

Edit `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Keep these for testing
NEXT_PUBLIC_USE_MOCK_LOCATION=true
NEXT_PUBLIC_SCHOOL_LAT=14.2225
NEXT_PUBLIC_SCHOOL_LON=121.0115
NEXT_PUBLIC_GEOFENCE_RADIUS=500
```

## Step 5: Restart Dev Server

```bash
npm run dev
```

The app will now use real Supabase!

## Test It

1. Go to http://localhost:3000/visit
2. Fill visitor form
3. **Destination dropdown will now load from Supabase** ✓
4. Complete registration
5. Visit appears in Security dashboard in real-time

## Troubleshooting

### Destinations dropdown still empty
- Check SQL migration ran successfully
- Verify environment variables are correct
- Check browser console for errors (F12)
- Try: `curl https://xxxxx.supabase.co/rest/v1/destinations`

### Login not working
- Demo auth is hardcoded in `/api/auth/login`
- Will integrate with Supabase Auth later
- For now, use demo credentials:
  - Security: `0917-123-4567` / `sec1234`
  - Admin: `0918-987-6543` / `admin1234`

### "Cannot find module" errors
- Delete `.next` folder: `rm -rf .next`
- Restart server: `npm run dev`

## Next Steps

Once database is connected:

1. **Real-time updates** - Security dashboard updates when visitor submits
2. **Face recognition** - Integrate ML model for face matching
3. **Supabase Auth** - Replace demo login with real authentication
4. **Email notifications** - Send security team alerts on new visitors

## Security Notes

🔒 **Never commit these files:**
- `.env.local`
- `.env` (if created)
- Any file with API keys

🔒 **Always use environment variables** for sensitive data

🔒 **Service Role Key is PRIVATE** - Only use server-side, never in browser

---

**Estimated time to setup: 10-15 minutes**

Once complete, the app becomes fully functional with real data persistence!
