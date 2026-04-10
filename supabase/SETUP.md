# Supabase Production Setup Guide
# دليل إعداد بيئة الإنتاج

## 1. Create Production Project

1. Go to https://supabase.com/dashboard
2. New Project → fill name/password → Region: closest to your users
3. Copy the **Project URL** and **anon public key** → paste in `.env.production`
4. Copy the **service_role key** → add to Supabase Edge Function secrets ONLY

## 2. Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Run all migrations in order
supabase db push
```

Or run manually in Supabase SQL Editor, in order:
- `migrations/001_*.sql` through `migrations/015_*.sql`

## 3. Enable Required Extensions

In Supabase Dashboard → Database → Extensions, enable:
- `pg_cron` — for scheduled auto-publisher
- `pg_net` — for HTTP calls from cron
- `uuid-ossp` — should already be enabled
- `pgcrypto` — for gen_random_uuid()

## 4. Deploy Edge Functions

```bash
# Deploy auto-publisher
supabase functions deploy auto-publisher

# Deploy analytics aggregator
supabase functions deploy analytics-aggregator

# Set secrets for edge functions
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 5. Configure Cron Jobs

After deploying edge functions, set pg_cron app settings:

```sql
-- In Supabase SQL Editor:
ALTER DATABASE postgres
  SET "app.supabase_url" = 'https://YOUR_PROJECT_ID.supabase.co';

ALTER DATABASE postgres
  SET "app.service_role_key" = 'your_service_role_key';
```

Then run migration `015_edge_functions_cron.sql` to register the cron jobs.

## 6. Configure Authentication

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://sbrandops.com`
- **Redirect URLs**: `https://sbrandops.com/*`

### Enable OAuth Providers:
- Facebook: Add App ID + Secret from Meta Developer Console
- Google: Add Client ID + Secret from Google Cloud Console

## 7. Storage Buckets

Create the following storage buckets (Dashboard → Storage → New Bucket):

| Bucket | Public | Description |
|--------|--------|-------------|
| `brand-media` | ✅ | Brand logos and assets |
| `post-media` | ✅ | Post images and videos |
| `avatars` | ✅ | User avatars |
| `reports` | ❌ | Private analytics reports |

Set storage policies:
```sql
-- brand-media: users can CRUD their own brand's files
CREATE POLICY "brand_media_access" ON storage.objects
  FOR ALL USING (
    bucket_id = 'brand-media' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM brands WHERE user_id = auth.uid()
    )
  );
```

## 8. Row Level Security Checklist

Verify all tables have RLS enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All `rowsecurity` should be `true`.

## 9. Build & Deploy Frontend

```bash
# Build production bundle
npm run build

# Output in: dist/
# Deploy to: Vercel / Netlify / Cloudflare Pages
```

### Vercel (Recommended)
```bash
npm install -g vercel
vercel --prod
```

Add all `VITE_*` variables in Vercel Dashboard → Project → Settings → Environment Variables.

### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## 10. Post-Deployment Checks

- [ ] Auth login/register works
- [ ] Brand creation saves to DB
- [ ] Publisher saves to `scheduled_posts`
- [ ] Auto-publisher cron appears in `cron.job_run_details`
- [ ] Sentry receives test error
- [ ] Analytics snapshots populate after 6 hours
