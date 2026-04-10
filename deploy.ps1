#!/usr/bin/env pwsh
# SBrandOps — Deploy Script
# شغّل هذا الـ script بعد تسجيل الدخول على Supabase CLI

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectRef,    # مثال: wxzcfdmjwggikmqeswvm
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceRoleKey = ""  # service_role key من Supabase Dashboard
)

Write-Host "🚀 SBrandOps Deploy Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. Link project
Write-Host "`n[1/4] Linking to Supabase project..." -ForegroundColor Yellow
npx supabase link --project-ref $ProjectRef

# 2. Push migrations
Write-Host "`n[2/4] Pushing database migrations..." -ForegroundColor Yellow
npx supabase db push

# 3. Deploy Edge Functions
Write-Host "`n[3/4] Deploying Edge Functions..." -ForegroundColor Yellow

$functions = @(
    "publish-now",
    "connect-accounts",
    "auto-publisher",
    "analytics-aggregator",
    "manage-social-account",
    "paddle-billing-manage",
    "paddle-checkout",
    "paddle-webhook",
    "paddle-webhook-auto-retry",
    "paddle-webhook-retry",
    "provider-oauth-callback",
    "provider-webhook"
)

foreach ($fn in $functions) {
    Write-Host "  Deploying: $fn" -ForegroundColor Gray
    npx supabase functions deploy $fn --no-verify-jwt 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  $fn failed — continuing..." -ForegroundColor Red
    } else {
        Write-Host "  ✅ $fn deployed" -ForegroundColor Green
    }
}

# 4. Set secrets
if ($ServiceRoleKey) {
    Write-Host "`n[4/4] Setting Edge Function secrets..." -ForegroundColor Yellow
    $supabaseUrl = "https://$ProjectRef.supabase.co"
    
    npx supabase secrets set SUPABASE_URL=$supabaseUrl
    npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey
    
    Write-Host "  ✅ Secrets set" -ForegroundColor Green
} else {
    Write-Host "`n[4/4] ⚠️  No ServiceRoleKey provided — skipping secrets" -ForegroundColor Yellow
    Write-Host "  Run manually: npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key" -ForegroundColor Gray
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✅ Deploy complete!" -ForegroundColor Green
Write-Host "Next: Run MASTER_FIX.sql in Supabase SQL Editor" -ForegroundColor White
