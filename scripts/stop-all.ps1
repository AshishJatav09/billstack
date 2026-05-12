$ports = @(5000, 5173)

foreach ($port in $ports) {
  $lines = netstat -ano | Select-String ":$port"
  $pids = $lines |
    Where-Object { $_.ToString() -match "LISTENING" } |
    ForEach-Object {
      ($_.ToString() -split "\s+")[-1]
    } |
    Where-Object { $_ -match "^\d+$" } |
    Select-Object -Unique

  foreach ($processId in $pids) {
    try {
      Stop-Process -Id ([int]$processId) -Force -ErrorAction Stop
      Write-Host "Stopped process $processId on port $port."
    } catch {
      Write-Warning "Could not stop process $processId on port $port."
    }
  }
}
