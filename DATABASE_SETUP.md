# 🗄️ Database Setup Guide

## Quick Setup (5 minutes)

Follow these steps to set up your Supabase database:

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project: `xosboyhviihchnoxtimj`
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Setup SQL

Copy the **entire content** of `setup_full.sql` and paste it into the SQL Editor, then click **Run**.

**Or use this quick link:**
```
https://supabase.com/dashboard/project/xosboyhviihchnoxtimj/sql/new
```

### Step 3: Verify Setup

After running the SQL, verify that the tables were created:

1. Go to **Table Editor** in Supabase
2. You should see these tables:
   - ✅ brands
   - ✅ brand_profiles
   - ✅ social_accounts
   - ✅ content_pieces
   - ✅ scheduled_posts
   - ✅ marketing_plans

### Step 4: Check Seed Data

1. Click on the **brands** table
2. You should see 2 brands:
   - Confort-Tex
   - Eco Threads

---

## ⚡ Alternative: Quick Setup Script

If you prefer to use a script, run:

```bash
npm run setup-db
```

**Note:** This requires your Supabase Service Role Key (not the Anon Key).

---

## 🔧 Manual Brand Creation

If you want to create a brand manually:

1. Go to **Table Editor** > **brands**
2. Click **Insert** > **Insert row**
3. Fill in:
   - name: "My Brand"
   - industry: "Your Industry"
   - logo_url: "https://picsum.photos/200"
4. Click **Save**

---

## ✅ Verification

After setup, refresh your app at https://localhost:3000/

You should now see:
- ✅ Real brand data (not "Demo Brand")
- ✅ Social accounts
- ✅ Content pieces
- ✅ Full dashboard with real data

---

## 🐛 Troubleshooting

### Error: "relation 'brands' does not exist"
**Solution:** Run `setup_full.sql` in Supabase SQL Editor

### Error: "permission denied"
**Solution:** Make sure RLS policies are set correctly (they're in the setup file)

### Still seeing "Demo Brand"?
**Solution:**
1. Check browser console for errors
2. Verify Supabase connection in `.env`
3. Make sure `getBrands()` is fetching from database

---

## 📞 Need Help?

Check the console output at https://localhost:3000/ for any error messages.
