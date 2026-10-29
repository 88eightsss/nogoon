# One-time NoGoon automation setup. Safe to run again.
# Run:  cd C:\Users\jtshi\nogoon; powershell -ExecutionPolicy Bypass -File scripts\setup-automation.ps1
$ErrorActionPreference = 'Continue'
$repo = '88eightsss/nogoon'
Set-Location (Join-Path $PSScriptRoot '..')

function Step($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ask($q) { (Read-Host "$q (y/n)") -match '^[yY]' }

Step 'GitHub CLI'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { gh auth login --hostname github.com --git-protocol https --web }
gh auth setup-git

Step 'Push the automation commit'
git push origin master

Step 'Security: Dependabot alerts + fixes, secret scanning, push protection'
gh api -X PUT "repos/$repo/vulnerability-alerts" --silent
gh api -X PUT "repos/$repo/automated-security-fixes" --silent
'{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' | gh api -X PATCH "repos/$repo" --input - --silent
Write-Host 'done'

Step 'Protect master (PR + green typecheck required; you can still bypass as admin)'
$existing = gh api "repos/$repo/rulesets" --jq '.[].name' 2>$null
if ($existing -match 'protect master') { Write-Host 'already set' } else {
$rules = @'
{"name":"protect master","target":"branch","enforcement":"active",
 "conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}},
 "bypass_actors":[{"actor_id":5,"actor_type":"RepositoryRole","bypass_mode":"always"}],
 "rules":[{"type":"deletion"},{"type":"non_fast_forward"},
  {"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":false}},
  {"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"required_status_checks":[{"context":"typecheck"}]}}]}
'@
$rules | gh api -X POST "repos/$repo/rulesets" --input - --silent
Write-Host 'done'
}

Step 'Labels'
gh workflow run repo-setup.yml --repo $repo 2>$null
Write-Host 'requested'

Step 'Secrets (each one asks you to paste the value here, not in chat)'
if (Ask 'Add EXPO_TOKEN now? Get it at expo.dev > Account settings > Access tokens') { gh secret set EXPO_TOKEN --repo $repo }
if (Ask 'Add SUPABASE_ACCESS_TOKEN now? Get it at supabase.com > Account > Access tokens') { gh secret set SUPABASE_ACCESS_TOKEN --repo $repo }

Step 'Claude on GitHub'
Write-Host 'Opening the Claude GitHub app install page. Choose only the nogoon repo.'
Start-Process 'https://github.com/apps/claude/installations/new'
if (Get-Command claude -ErrorAction SilentlyContinue) {
  if (Ask 'Create the Claude token now? A browser opens; copy the token it prints') {
    claude setup-token
    gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo $repo
  }
} else {
  Write-Host 'Claude Code CLI not found. Install it with:  npm install -g @anthropic-ai/claude-code   then run this script again.'
}

Step 'Finished'
Write-Host "Actions: https://github.com/$repo/actions"
