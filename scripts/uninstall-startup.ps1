# Stops and removes the Scheduled Task created by install-startup.ps1, and
# kills the server it started.

param([string]$TaskName = 'Bookmarks')

$ErrorActionPreference = 'Stop'

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'."
} else {
  Write-Host "No scheduled task named '$TaskName'."
}

# Stopping the task doesn't kill start.ps1's node child.
$entry = Join-Path (Split-Path -Parent $PSScriptRoot) '.output\server\index.mjs'
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*$entry*" } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "Stopped server (pid $($_.ProcessId))."
  }
