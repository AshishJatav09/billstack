$ports = @(
  @{ Port = 5000; Name = "Backend" },
  @{ Port = 5173; Name = "Frontend" }
)

foreach ($item in $ports) {
  $match = netstat -ano | Select-String ":$($item.Port)" | Where-Object { $_.ToString() -match "LISTENING" } | Select-Object -First 1

  if ($match) {
    $processId = ($match.ToString() -split "\s+")[-1]
    Write-Host "$($item.Name) is running on port $($item.Port) (PID $processId)."
  } else {
    Write-Host "$($item.Name) is not running on port $($item.Port)."
  }
}
