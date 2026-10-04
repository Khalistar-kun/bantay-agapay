# Bantay-Agapay
Digital Visitor Management & Campus Wayfinding System for AFGBMTS

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier)

### Installation

```bash
# Clone repository
cd Bantay-Agapay

# Install dependencies
npm install

# Create .env.local with Supabase credentials
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Development

```bash
npm run dev
```

Visit http://localhost:3000

### Build & Deploy to Vercel

```bash
npm run build
npm start
```

Push to GitHub, connect to Vercel for automatic deployments.

### GitHub builds

The `Build app` workflow runs TypeScript checks and a production build on pushes
to `main`, pull requests, or manual dispatch. Download `nextjs-build` from the
workflow run to inspect the compiled output. CI uses dummy Supabase settings;
configure the real values from `.env.example` on your deployment host. GitHub
Pages cannot serve this app's authentication and API routes; use a Node.js host
such as Vercel for a live deployment.

### UI theme

The UI uses the existing AFGBMTS project red palette, with gold and white accents.
This is a provisional school-inspired palette, not verified official color codes.
Update `primary` and `gold` in `tailwind.config.js` when official colors are available.

## Database Setup

1. Create new Supabase project
2. Run SQL migrations from `supabase/migrations/00_initial_schema.sql`
3. Configure RLS policies (configured in schema)

## Demo Credentials

**Security Staff:**
- Phone: `0917-123-4567`
- Password: `sec1234`

**Administrator:**
- Phone: `0918-987-6543`
- Password: `admin1234`

## Architecture

### Pages
- `/` - Landing page
- `/visit` - Visitor registration (4-step flow)
- `/visit/status/[token]` - Visitor approval status
- `/visit/directions/[token]` - Campus wayfinding
- `/login` - Staff authentication
- `/security` - Security dashboard
- `/admin` - Admin dashboard

### API Routes
- `POST /api/visit/submit` - Submit visitor registration
- `POST /api/auth/login` - Staff login
- `GET /api/admin/stats` - Dashboard statistics

### Database
- `visitors` - Visitor profiles (reusable across visits)
- `visits` - Individual visit records
- `destinations` - Campus locations
- `verification_logs` - Face/GPS verification results
- `profiles` - Staff accounts (security/admin)
- `system_settings` - Configuration
- `audit_logs` - Action tracking

## Key Features Implemented

✓ Visitor registration form (4-step process)
✓ Face capture interface (ready for integration)
✓ GPS location verification UI
✓ Visit submission & reference number generation
✓ Visitor status page with real-time polling
✓ Campus directions page with landmarks
✓ Security dashboard for pending visitors
✓ Admin dashboard with stats
✓ Staff authentication (demo mode)
✓ Responsive mobile-first design
✓ Database schema with RLS

## Integration Points for Completion

### Face Recognition
Replace placeholder in `/components/visitor/RegistrationForm.tsx`:
- Integrate `@vladmandic/human` or alternative
- Store face embeddings in `visitors.face_embedding`
- Implement matching logic for returning visitors

### Real-time Updates
- Supabase Realtime already structured
- Subscribe to visit status changes in status page
- Subscribe to pending visitors in security dashboard

### Security Review View
- Create `/security/review/[visitId]` page
- Display visitor details with face verification status
- Add approve/deny actions

### Currently Inside
- Create `/security/inside` page
- Real-time visitor duration calculation
- Checkout functionality

### Admin Features
- Visitor records search & filtering
- Destination CRUD
- Personnel account management
- Reports & analytics

## Deployment Checklist

- [ ] Set real Supabase URL and keys in production
- [ ] Configure Vercel environment variables
- [ ] Enable Supabase RLS policies
- [ ] Set up email notifications (optional)
- [ ] Configure actual school GPS coordinates
- [ ] Upload official AFGBMTS logo
- [ ] Create campus map SVG
- [ ] Test complete visitor flow
- [ ] Security staff training

## Notes

- MVP prioritizes functionality over polish
- Face recognition not yet integrated (API placeholder ready)
- GPS tracking is ONE-TIME verification, not continuous
- All visitor data is stored securely with RLS
- System respects free-tier limits (Vercel + Supabase)
