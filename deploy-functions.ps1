
# deploy-functions.ps1
# Run with: .\deploy-functions.ps1

Write-Host "Deploying SBrandOps Edge Functions..." -ForegroundColor Cyan

# Check Supabase CLI
$sbCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $sbCmd) {
    Write-Host ""
    Write-Host "ERROR: Supabase CLI not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it with:" -ForegroundColor Yellow
    Write-Host "  npm install -g supabase" -ForegroundColor White
    Write-Host "  -- OR --" -ForegroundColor DarkGray
    Write-Host "  winget install Supabase.CLI" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run:" -ForegroundColor Yellow
    Write-Host "  supabase login" -ForegroundColor White
    Write-Host "  supabase link --project-ref wxzcfdmjwggikmqeswvm" -ForegroundColor White
    Write-Host ""
    exit 1
}

# All critical Edge Functions
$functions = @(
    "publish-now",
    "auto-publisher",
    "connect-accounts",
    "google-oauth",
    "provider-oauth-callback",
    "provider-webhook",
    "data-sync",
    "analytics-aggregator",
    "manage-social-account",
    "paddle-webhook",
    "paddle-checkout",
    "paddle-billing-manage"
)

$successCount = 0
$failCount = 0

foreach ($fn in $functions) {
    Write-Host ""
    Write-Host "Deploying: $fn ..." -ForegroundColor Yellow

    supabase functions deploy $fn --no-verify-jwt
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host "  OK: $fn deployed" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  FAILED: $fn (exit code $exitCode)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "Deployed OK : $successCount functions" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "Failed      : $failCount functions" -ForegroundColor Red
}
Write-Host ""
Write-Host "Check your functions at:" -ForegroundColor Cyan
Write-Host "  https://supabase.com/dashboard/project/wxzcfdmjwggikmqeswvm/functions" -ForegroundColor White
Write-Host ""
