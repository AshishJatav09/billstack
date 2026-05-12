powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\stop-all.ps1"
Start-Sleep -Seconds 2
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\dev-all.ps1"
