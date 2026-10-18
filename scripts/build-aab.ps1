# Build the signed Play Store bundle (.aab) on this PC, for when EAS cloud builds are used up.
# Run from the repo root:   powershell -ExecutionPolicy Bypass -File scripts\build-aab.ps1
# You need your upload keystore file first (see the steps in the chat: eas credentials -> download keystore).

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$ksPath = Read-Host "Full path to your keystore file (e.g. C:\Users\jtshi\keys\nogoon-upload.jks)"
if (-not (Test-Path $ksPath)) { throw "Keystore not found at $ksPath" }
$alias  = Read-Host "Key alias"
$storePw = Read-Host "Keystore password" -AsSecureString
$keyPw   = Read-Host "Key password (press Enter if it is the same as the keystore password)" -AsSecureString
function Plain($s) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
$sp = Plain $storePw
$kp = Plain $keyPw
if (-not $kp) { $kp = $sp }

# These live only in this PowerShell window.
$env:NOGOON_KEYSTORE        = (Resolve-Path $ksPath).Path
$env:NOGOON_KEY_ALIAS       = $alias
$env:NOGOON_STORE_PASSWORD  = $sp
$env:NOGOON_KEY_PASSWORD    = $kp

Write-Host "1/3 Installing packages..." -ForegroundColor Cyan
npm install

Write-Host "2/3 Regenerating the Android project..." -ForegroundColor Cyan
npx expo prebuild --platform android --clean

Write-Host "3/3 Building the signed bundle (several minutes)..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat bundleRelease "-I" "..\scripts\upload-signing.gradle"
$code = $LASTEXITCODE
Pop-Location
Remove-Item Env:NOGOON_STORE_PASSWORD, Env:NOGOON_KEY_PASSWORD -ErrorAction SilentlyContinue
if ($code -ne 0) { throw "Gradle build failed (exit $code). Scroll up for the first red error and send it to me." }

$aab = "android\app\build\outputs\bundle\release\app-release.aab"
Write-Host ""
Write-Host "Done. Upload this file in Play Console:" -ForegroundColor Green
Write-Host (Resolve-Path $aab).Path
