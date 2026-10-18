# Build NoGoon (release) and install it on the USB-connected phone.
# Run from the repo root:   powershell -ExecutionPolicy Bypass -File scripts\install-phone.ps1
# Before: phone plugged in by USB, USB debugging on, "Allow" the computer when the phone asks.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "1/4 Checking the phone is connected..." -ForegroundColor Cyan
$devices = (adb devices) | Select-Object -Skip 1 | Where-Object { $_ -match "\tdevice$" }
if (-not $devices) { throw "No phone found. Plug it in, turn on USB debugging, tap Allow on the phone, then run this again." }
Write-Host $devices

Write-Host "2/4 Installing packages..." -ForegroundColor Cyan
npm install

Write-Host "3/4 Regenerating the Android project (picks up the native changes)..." -ForegroundColor Cyan
npx expo prebuild --platform android

Write-Host "4/4 Building the release app and installing it (first build takes several minutes)..." -ForegroundColor Cyan
npx expo run:android --variant release

Write-Host ""
Write-Host "Done. Open NoGoon on the phone." -ForegroundColor Green
Write-Host "If it ever shows 'stopping working', run:  adb logcat -d -s AndroidRuntime:E *:F > crash.txt   and send me crash.txt"
