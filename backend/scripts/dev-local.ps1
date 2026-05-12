$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $backendRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$mongoConfigPath = Join-Path $workspaceRoot "mongo-rs\\mongod.cfg"
$mongoBinaryPath = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
$mongoPort = 27018

function Test-PortOpen {
  param(
    [string]$HostName,
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
    $connected = $asyncResult.AsyncWaitHandle.WaitOne(700)

    if (-not $connected) {
      return $false
    }

    $client.EndConnect($asyncResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

if (-not (Test-PortOpen -HostName "127.0.0.1" -Port $mongoPort)) {
  if ((Test-Path $mongoBinaryPath) -and (Test-Path $mongoConfigPath)) {
    Write-Host "Starting local MongoDB replica set on port $mongoPort..."
    Start-Process -FilePath $mongoBinaryPath -ArgumentList "--config", $mongoConfigPath -WindowStyle Hidden

    $attempt = 0

    while ($attempt -lt 20 -and -not (Test-PortOpen -HostName "127.0.0.1" -Port $mongoPort)) {
      Start-Sleep -Milliseconds 750
      $attempt += 1
    }

    if (-not (Test-PortOpen -HostName "127.0.0.1" -Port $mongoPort)) {
      throw "MongoDB did not become available on 127.0.0.1:$mongoPort"
    }
  } else {
    Write-Warning "MongoDB replica set config not found. Expected: $mongoConfigPath"
    Write-Warning "If you want transaction-safe local mode, start mongod manually before running the backend."
  }
}

Set-Location $backendRoot
node src/server.js
