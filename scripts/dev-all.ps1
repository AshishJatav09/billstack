$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root "backend"
$frontendPath = Join-Path $root "frontend"

function Test-PortListening {
  param(
    [int]$Port
  )

  $matches = netstat -ano | Select-String ":$Port"
  return ($matches | Where-Object { $_.ToString() -match "LISTENING" }).Count -gt 0
}

function Start-ServiceWindow {
  param(
    [string]$WorkingDirectory,
    [string]$Title,
    [string]$Command
  )

  Start-Process -FilePath "C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkingDirectory'; `$host.UI.RawUI.WindowTitle = '$Title'; $Command"
}

$backendRunning = Test-PortListening -Port 5000
$frontendRunning = Test-PortListening -Port 5173

if (-not $backendRunning) {
  Write-Host "Starting backend on http://localhost:5000 ..."
  Start-ServiceWindow -WorkingDirectory $backendPath -Title "BillStack Backend" -Command "npm run dev"
} else {
  Write-Host "Backend already running on port 5000."
}

if (-not $frontendRunning) {
  Write-Host "Starting frontend on http://localhost:5173 ..."
  Start-ServiceWindow -WorkingDirectory $frontendPath -Title "BillStack Frontend" -Command "npm run dev"
} else {
  Write-Host "Frontend already running on port 5173."
}

Write-Host ""
Write-Host "BillStack launch command finished."
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:5000"
