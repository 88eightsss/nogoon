# Applies the newest database migrations, redeploys the backend functions (briefing, events, crash reports, health), then refreshes the
# cron secret/schedule and runs the briefing once (keeps the Anthropic key you already stored).
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\feed-refresh.ps1
$ref = 'hadcagughbyouagwpdhq'
$env:DO_NOT_TRACK = '1'; $env:SUPABASE_TELEMETRY_DISABLED = '1'

Write-Host "`n1/3  Database: applying new migrations (answer Y when asked)"
npx --yes supabase@2.109.1 db push
if ($LASTEXITCODE -ne 0) { Write-Host "     (db push reported exit code $LASTEXITCODE. If it said 'Finished supabase db push', that is only the usage-stats upload timing out.)" }

Write-Host "`n2/3  Deploying the briefing and events functions"
npx --yes supabase@2.109.1 functions deploy feed-daily --project-ref $ref --no-verify-jwt
if ($LASTEXITCODE -ne 0) { Write-Host "     (deploy reported exit code $LASTEXITCODE. If it said 'Deployed Functions', carry on.)" }

npx --yes supabase@2.109.1 functions deploy events-draft --project-ref $ref --no-verify-jwt
if ($LASTEXITCODE -ne 0) { Write-Host "     (deploy reported exit code $LASTEXITCODE. If it said 'Deployed Functions', carry on.)" }

npx --yes supabase@2.109.1 functions deploy report-crash --project-ref $ref
if ($LASTEXITCODE -ne 0) { Write-Host "     (deploy reported exit code $LASTEXITCODE. If it said 'Deployed Functions', carry on.)" }

npx --yes supabase@2.109.1 functions deploy health --project-ref $ref --no-verify-jwt
if ($LASTEXITCODE -ne 0) { Write-Host "     (deploy reported exit code $LASTEXITCODE. If it said 'Deployed Functions', carry on.)" }

Write-Host "`n3/3  Refreshing the schedule and running the briefing"
& "$PSScriptRoot\feed-go.ps1" -SkipKey
