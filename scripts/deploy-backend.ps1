# NoGoon backend setup: migrations, secrets, edge functions, cron.
# Run from the repo root in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-backend.ps1
# Safe to re-run. Secrets are typed here (hidden) and go straight to Supabase; nothing is saved to disk
# except a temporary cron SQL file that is copied to your clipboard and then deleted.
# Needs: Node (for npx) or the Supabase CLI, and `supabase login` done once.

$ErrorActionPreference = 'Stop'
$ref = 'hadcagughbyouagwpdhq'

function SB {
  if (Get-Command supabase -ErrorAction SilentlyContinue) { & supabase @args }
  else { & npx --yes supabase@latest @args }
  if ($LASTEXITCODE -ne 0) { throw "supabase $($args -join ' ') failed" }
}
function Ask([string]$label, [switch]$Secret) {
  if ($Secret) {
    $s = Read-Host $label -AsSecureString
    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
  }
  return (Read-Host $label)
}
function SetSecret([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { Write-Host "  skipped $name"; return }
  SB secrets set "$name=$value" --project-ref $ref | Out-Null
  Write-Host "  set $name"
}

Write-Host "`n1/6  Logging in and linking the project"
Write-Host "     (if this is your first time: run  supabase login  in another window first)"
SB link --project-ref $ref

Write-Host "`n2/6  Database migrations (shows what will run, asks before applying)"
SB migration list
SB db push

Write-Host "`n3/6  Secrets (press Enter to skip any you do not have yet)"
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$cron = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
SetSecret 'CRON_SECRET' $cron
SetSecret 'ANTHROPIC_API_KEY'      (Ask 'Anthropic API key for the daily briefing (sk-ant-...)' -Secret)
SetSecret 'STRIPE_SECRET_KEY'      (Ask 'Stripe secret key (use sk_test_... first)' -Secret)
SetSecret 'WALL_WEB_URL'           (Ask 'Where the advertise page is hosted (https://...), or Enter to add later')
SetSecret 'STRIPE_WEBHOOK_SECRET'  (Ask 'Stripe webhook signing secret (whsec_...), or Enter to add later' -Secret)

Write-Host "`n4/6  Edge functions"
SB functions deploy feed-daily    --project-ref $ref --no-verify-jwt
SB functions deploy events-draft  --project-ref $ref --no-verify-jwt
SB functions deploy wall          --project-ref $ref
SB functions deploy wall-webhook  --project-ref $ref --no-verify-jwt

Write-Host "`n5/6  Daily schedules"
$sql = @"
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('feed-daily', '0 14 * * *',
  `$`$ select net.http_post(
         url := 'https://$ref.supabase.co/functions/v1/feed-daily',
         headers := jsonb_build_object('x-cron-secret', '$cron')
       ); `$`$);
select cron.schedule('events-draft', '0 13 * * 1',
  `$`$ select net.http_post(
         url := 'https://$ref.supabase.co/functions/v1/events-draft',
         headers := jsonb_build_object('x-cron-secret', '$cron')
       ); `$`$);
select cron.schedule('wall-maintenance', '5 * * * *', `$`$ select public.wall_maintenance(); `$`$);
"@
$tmp = Join-Path $env:TEMP 'nogoon-cron.sql'
Set-Content -Path $tmp -Value $sql -Encoding UTF8
Set-Clipboard -Value $sql
Write-Host "     The schedule SQL is on your clipboard. Open Supabase > SQL Editor > New query, paste, Run."
Read-Host "     Press Enter once it has run"
Remove-Item $tmp -Force

Write-Host "`n6/6  Test the daily briefing once"
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://$ref.supabase.co/functions/v1/feed-daily" -Headers @{ 'x-cron-secret' = $cron }
  Write-Host "     feed-daily answered: $($r | ConvertTo-Json -Compress)"
  Write-Host "     (stored = good-news items, wiki = Wikipedia items; check Edge Function logs if wiki is 0)"
} catch { Write-Host "     feed-daily test failed: $($_.Exception.Message)" }

Write-Host @"

Done. Still to do by hand:
  - Stripe: create the account, add a webhook endpoint
      https://$ref.supabase.co/functions/v1/wall-webhook
    for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired,
    then re-run this script (or: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...).
  - Host web/advertise/index.html (Netlify Drop works), then set ADVERTISE_URL in constants/wall.ts
    and the WALL_WEB_URL secret to that address.
"@
