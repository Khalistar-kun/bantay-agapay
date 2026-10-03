# Bantay-Agapay Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Select your organization
5. Project name: `bantay-agapay`
6. Database password: (generate strong password)
7. Region: Select closest to your location (Philippines if available, or Asia-Pacific)
8. Click "Create new project"

Wait for project initialization (2-3 minutes)

## Step 2: Configure Database

1. In Supabase dashboard, click "SQL Editor"
2. Create new query
3. Copy entire contents of `supabase/migrations/00_initial_schema.sql`
4. Paste into SQL editor
5. Click "Run"
6. Wait for success message

You should see:
- 8 tables created
- Indexes created
- RLS policies configured
- Sample destinations inserted

## Step 3: Get API Keys

1. In Supabase dashboard, go to Settings → API
2. Copy:
   - Project URL (e.g., https://xxxxx.supabase.co)
   - `anon` public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - `service_role` secret key (SUPABASE_SERVICE_ROLE_KEY)

⚠️ **WARNING**: Service role key is sensitive! Never commit to git, only use in backend.

## Step 4: Configure Environment

1. Create `.env.local` in project root:

```bash
cp .env.example .env.local
```

2. Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## Step 5: Install & Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:3000

### Test Visitor Flow
1. Go to / (home)
2. Click "Visitor Registration"
3. Fill form with test data
4. Complete all 4 steps
5. Get reference number & status token

### Test Security Dashboard
1. Go to /login
2. Email: `demo@afgbmts.edu.ph`
3. Password: `demo1234`
4. See "Pending Visitors" dashboard

### Test Admin Dashboard
1. Go to /login
2. Email: `admin@afgbmts.edu.ph`
3. Password: `admin1234`
4. See admin dashboard with stats

## Step 6: Deployment to Vercel

### Option A: Deploy via Vercel Dashboard

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "Add New..." → "Project"
4. Import from GitHub
5. Select `bantay-agapay` repository
6. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Click "Deploy"

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Step 7: Configure Supabase RLS (Row Level Security)

All RLS policies are already configured in the migration SQL, but verify:

1. In Supabase → SQL Editor
2. Run:

```sql
-- Verify RLS is enabled on critical tables
SELECT tablename FROM pg_tables WHERE tablename IN ('visits', 'visitors', 'verification_logs');

-- Check enabled RLS
SELECT tablename, rowsecurity FROM pg_class WHERE tablename IN ('visits', 'visitors', 'verification_logs');
```

Should see `rowsecurity = true` for all tables.

## Step 8: (Optional) Setup Local Supabase

For development without internet:

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize local setup
supabase init

# Start local services
supabase start

# Run migrations locally
supabase migration list
```

## Troubleshooting

### "Supabase URL is required" during build
Make sure `.env.local` exists with valid Supabase credentials.

### Migrations fail in Supabase
- Check that project is fully initialized
- Try running each statement individually
- Check quota limits in Free tier

### Visitor form loads but destinations empty
- Verify `destinations` table has data
- Check RLS policies allow SELECT on destinations

### Demo login doesn't work
- Demo auth is hardcoded in `/api/auth/login`
- In production, integrate with Supabase Auth

## Next Steps

1. **Face Recognition**: Integrate @vladmandic/human library
2. **Campus Map**: Create SVG map of AFGBMTS
3. **Real-time**: Implement Supabase Realtime subscriptions
4. **Email Notifications**: Add nodemailer or SendGrid
5. **SMS**: Add Twilio for SMS alerts
6. **Logo**: Add official AFGBMTS school logo
7. **Customization**: Update school name, coordinates, colors

## Support

For issues:
1. Check Supabase dashboard status
2. Review browser console for errors
3. Check Vercel build logs
4. Verify environment variables are set correctly
