# Sets the real Anthropic key, makes a fresh cron secret, refreshes the daily schedules, and runs the briefing once.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\feed-go.ps1
param([switch]$SkipKey)   # -SkipKey: keep the Anthropic key already stored, only refresh the cron secret and run the briefing
$ref = 'hadcagughbyouagwpdhq'
$env:DO_NOT_TRACK = '1'; $env:SUPABASE_TELEMETRY_DISABLED = '1'

$key = $null
if (-not $SkipKey) {
  $s = Read-Host 'Paste your Anthropic API key (sk-ant-..., hidden as you type)' -AsSecureString
  $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
  if ($key -notmatch '^sk-ant-[A-Za-z0-9_\-]{20,}$') { Write-Host "That does not look like a real key (it must start with sk-ant- and be long). Nothing changed."; exit 1 }
}

$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$cron = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

Write-Host "`nSetting secrets"
if ($key) { npx --yes supabase@2.109.1 secrets set "ANTHROPIC_API_KEY=$key" "CRON_SECRET=$cron" --project-ref $ref }
else      { npx --yes supabase@2.109.1 secrets set "CRON_SECRET=$cron" --project-ref $ref }

$sql = @"
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('feed-daily', '0 14 * * *',
  `$`$ select net.http_post(
         url := 'https://$ref.supabase.co/functions/v1/feed-daily',
         headers := jsonb_build_object('x-cron-secret', '$cron')
       ); `$`$);
select cron.schedule('events-draft', '0 13 * * 1,4',
  `$`$ select net.http_post(
         url := 'https://$ref.supabase.co/functions/v1/events-draft',
         headers := jsonb_build_object('x-cron-secret', '$cron')
       ); `$`$);
select cron.schedule('wall-maintenance', '5 * * * *', `$`$ select public.wall_maintenance(); `$`$);
select cron.schedule('supporter-sweep', '20 */6 * * *',
  `$`$ select net.http_post(
         url := 'https://$ref.supabase.co/functions/v1/supporter-sweep',
         headers := jsonb_build_object('x-cron-secret', '$cron')
       ); `$`$);
"@
$sqlFile = Join-Path $env:TEMP "nogoon-cron.sql"
Set-Content -Path $sqlFile -Value $sql -Encoding UTF8
Set-Clipboard -Value $sql
Start-Process notepad.exe $sqlFile
Write-Host "`nThe schedule SQL (with the NEW secret) is on your clipboard."
Write-Host "Supabase > SQL Editor > New query > paste > Run. (Re-running it just updates the existing schedules.)"
Read-Host "Press Enter once it has run"
Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

Write-Host "`nRunning the briefing once (can take 30-60 seconds)"
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://$ref.supabase.co/functions/v1/feed-daily" -Headers @{ 'x-cron-secret' = $cron } -TimeoutSec 170
  Write-Host "feed-daily answered: $($r | ConvertTo-Json -Compress)"
} catch {
  Write-Host "feed-daily failed: $($_.Exception.Message)"
  Write-Host "Open Supabase > Edge Functions > feed-daily > Logs and send me the newest red line."
}

Write-Host "`nReading local news and event pages (can take a minute or two)"
try {
  $e = Invoke-RestMethod -Method Post -Uri "https://$ref.supabase.co/functions/v1/events-draft" -Headers @{ 'x-cron-secret' = $cron } -TimeoutSec 175
  Write-Host "events-draft answered (number = events found, or the reason a source failed):"
  $e.drafted.PSObject.Properties | ForEach-Object { Write-Host "  $($_.Name): $($_.Value)" }
} catch {
  Write-Host "events-draft failed: $($_.Exception.Message)"
  Write-Host "Open Supabase > Edge Functions > events-draft > Logs and send me the newest red line."
}
