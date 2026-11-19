# Stable public HTTPS for Grok Bot MCP (same URL every time).
# 1) Claim free domain: https://dashboard.ngrok.com/domains
# 2) Put in backend/.env:  NGROK_DOMAIN=your-name.ngrok-free.app
# 3) Run:  powershell -File backend/scripts/start_grok_tunnel.ps1
# Keep: python -m thin_ice.mcp_server  on :8001

$ErrorActionPreference = "Stop"
$backend = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backend ".env"
$domain = $null
if (Test-Path $envFile) {
  $line = Select-String -LiteralPath $envFile -Pattern "^\s*NGROK_DOMAIN\s*=" | Select-Object -First 1
  if ($line) {
    $domain = ($line.Line -split "=", 2)[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $domain) {
  Write-Host ""
  Write-Host "No NGROK_DOMAIN in backend/.env"
  Write-Host "Claim one free static domain (once), then add:"
  Write-Host "  NGROK_DOMAIN=your-name.ngrok-free.app"
  Write-Host ""
  Start-Process "https://dashboard.ngrok.com/domains"
  exit 1
}

$domain = $domain -replace '^https?://', '' -replace '/.*$', ''
$url = "https://$domain"
Write-Host "Grok connector URL (permanent):"
Write-Host "  $url/mcp"
Write-Host ""
ngrok http 8001 --url $url
