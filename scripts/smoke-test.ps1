# Quick check that the live backend answers the way it should. Safe to run any time: it changes nothing that matters
# (one usage count with a throwaway code, and a spam-trap submission that is thrown away).
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
# Run it after scripts\feed-refresh.ps1. Red FAIL lines tell you what to fix; "ok" lines are fine.

$src = Get-Content "$PSScriptRoot\..\lib\supabase.ts" -Raw
$url = [regex]::Match($src, "SUPABASE_URL\s*=\s*'([^']+)'").Groups[1].Value
$key = [regex]::Match($src, "SUPABASE_ANON_KEY\s*=\s*'([^']+)'").Groups[1].Value
if (-not $url -or -not $key) { Write-Host "Could not read the project address and key from lib\supabase.ts"; exit 1 }
$auth = @{ apikey = $key; Authorization = "Bearer $key" }
$script:fails = 0

function Call([string]$method, [string]$path, $headers, [string]$body) {
  try {
    $p = @{ Uri = "$url$path"; Method = $method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 30 }
    if ($body) { $p.Body = $body; $p.ContentType = 'application/json' }
    $r = Invoke-WebRequest @p
    return @{ code = [int]$r.StatusCode; body = $r.Content }
  } catch {
    $code = 0; $text = ''
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      try { $text = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    } else { $text = $_.Exception.Message }
    return @{ code = $code; body = $text }
  }
}
function Check([string]$name, [bool]$pass, [string]$detail) {
  if ($pass) { Write-Host ("  ok    " + $name) -ForegroundColor Green }
  else { Write-Host ("  FAIL  " + $name + "  ->  " + $detail) -ForegroundColor Red; $script:fails++ }
}

Write-Host "`nNoGoon backend smoke test ($url)`n"

Write-Host "Scheduled jobs (health)"
$h = Call 'GET' '/functions/v1/health' @{} ''
if ($h.code -eq 200 -or $h.code -eq 503) {
  try {
    $j = $h.body | ConvertFrom-Json
    foreach ($name in $j.jobs.PSObject.Properties.Name) {
      $row = $j.jobs.$name
      $age = if ($row.ageHours -ne $null) { "last good run $($row.ageHours)h ago" } else { 'never ran successfully' }
      Check "job $name" ([bool]$row.healthy) $age
    }
  } catch { Check 'health answers with JSON' $false $h.body }
} else { Check 'health function is deployed' $false "status $($h.code). Run scripts\feed-refresh.ps1" }

Write-Host "`nScheduled functions refuse strangers (expect 403)"
foreach ($f in 'feed-daily','events-draft','local-news') {
  $r = Call 'POST' "/functions/v1/$f" @{} ''
  Check "$f is deployed and locked" ($r.code -eq 403) "status $($r.code)"
}

Write-Host "`nPublic functions"
$r = Call 'POST' '/functions/v1/event-submit' @{} '{"website":"spam trap"}'
Check 'event-submit takes a spam-trap post and stores nothing' ($r.code -eq 200 -and $r.body -match 'ok') "status $($r.code) $($r.body)"
$r = Call 'POST' '/functions/v1/event-submit' @{} '{}'
Check 'event-submit rejects an empty post' ($r.code -ge 400 -and $r.code -lt 500) "status $($r.code)"
$r = Call 'POST' '/functions/v1/report-crash' $auth '{"kind":"nope"}'
Check 'report-crash rejects a bad report' ($r.code -eq 400) "status $($r.code)"
$r = Call 'POST' '/functions/v1/place-search' @{} '{}'
Check 'place-search needs the app key' ($r.code -eq 401) "status $($r.code)"

Write-Host "`nDatabase"
$tok = -join ((48..57 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$r = Call 'POST' '/rest/v1/rpc/report_usage' $auth ('{"p_token":"' + $tok + '","p_version":"smoke","p_counts":{"gate_open":1}}')
Check 'usage counts accepted (report_usage)' ($r.code -ge 200 -and $r.code -lt 300) "status $($r.code) $($r.body)"
foreach ($t in 'usage_daily','usage_active','event_submissions','place_requests','job_runs','crash_reports') {
  $r = Call 'GET' "/rest/v1/${t}?select=*&limit=1" $auth ''
  Check "$t is closed to the public" ($r.code -ge 400 -or $r.body -eq '[]') "status $($r.code) returned data"
}
$r = Call 'GET' '/rest/v1/community_events?select=id,title&limit=1' $auth ''
Check 'events list readable' ($r.code -eq 200) "status $($r.code)"
$r = Call 'GET' '/rest/v1/local_news?select=id,title&limit=1' $auth ''
Check 'local news list readable' ($r.code -eq 200) "status $($r.code)"
$r = Call 'GET' '/rest/v1/community_events?select=id&signup_url=eq.http://bad.example&limit=1' $auth ''
Check 'sign-up link columns exist (migration 20261029)' ($r.code -eq 200) "status $($r.code)"

Write-Host ""
if ($script:fails -eq 0) { Write-Host "All checks passed." -ForegroundColor Green }
else { Write-Host "$($script:fails) check(s) failed. The top red line is the one to fix first." -ForegroundColor Red }
exit $script:fails
