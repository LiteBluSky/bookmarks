# Registers a Windows Scheduled Task that runs scripts/start.ps1 hidden at
# logon of the current user, then starts it right away. Re-running replaces
# the existing task. Undo with uninstall-startup.ps1.

param([string]$TaskName = 'Bookmarks')

$ErrorActionPreference = 'Stop'

$startScript = Join-Path $PSScriptRoot 'start.ps1'
$user = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`"" `
  -WorkingDirectory (Split-Path -Parent $PSScriptRoot)

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName `
  -Description 'Local bookmark manager on http://localhost:8008' `
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal |
  Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Host "Registered and started scheduled task '$TaskName' -> http://localhost:8008"
