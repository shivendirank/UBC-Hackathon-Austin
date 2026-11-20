# Copies ElevenLabs keys from backend/.env into Vercel (Production + Preview).
# Run from repo root:  powershell -File scripts/set-vercel-elevenlabs-env.ps1
# Requires: npx vercel logged in, web/ linked to the thin-ice project.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "backend\.env"
$web = Join-Path $root "web"

if (-not (Test-Path $envFile)) { throw "Missing backend/.env" }

$map = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $map[$matches[1].Trim()] = $matches[2].Trim()
  }
}

$key = $map["ELEVENLABS_API_KEY"]
$agent = $map["ELEVENLABS_AGENT_ID"]
if (-not $key -or -not $agent) { throw "ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID missing in backend/.env" }

Set-Location $web

function Set-VercelEnv([string]$Name, [string]$Value, [string]$Target) {
  Write-Host "Setting $Name ($Target)..."
  $Value | npx --yes vercel env add $Name $Target --force 2>&1 | Out-Host
}

foreach ($target in @("production", "preview")) {
  Set-VercelEnv "ELEVENLABS_API_KEY" $key $target
  Set-VercelEnv "ELEVENLABS_AGENT_ID" $agent $target
}

Write-Host ""
Write-Host "Done. Redeploy the web app (push to GitHub or: npx vercel --prod)."
Write-Host "Confirm NEXT_PUBLIC_API_URL=/backend and THIN_ICE_API_URL=<your ngrok URL> are also set."
