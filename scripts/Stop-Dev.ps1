$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pidFile = Join-Path $workspaceRoot 'infrastructure/.run/processes.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'No recorded development session.'; return }
$processRecords = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$remainingRecords = @()
foreach ($record in $processRecords) {
    $ownedProcess = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    $startMatches = $ownedProcess -and $record.started_ticks -and ([Math]::Abs($ownedProcess.StartTime.ToUniversalTime().Ticks - [long]$record.started_ticks) -lt [TimeSpan]::TicksPerSecond)
    if ($ownedProcess -and $ownedProcess.Path -eq $record.path -and $startMatches) {
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($ownedProcess.Id)"
        foreach ($child in $children) { Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue }
        Stop-Process -Id $ownedProcess.Id -ErrorAction SilentlyContinue
        $ownedProcess.WaitForExit()
        Write-Output "Stopped $($record.name)"
    } elseif ($ownedProcess) {
        $remainingRecords += $record
        Write-Warning "Skipped $($record.name): current process does not match the recorded executable/start time."
    }
}
if ($remainingRecords.Count -gt 0) { $remainingRecords | ConvertTo-Json | Set-Content -LiteralPath $pidFile; throw 'Some process records could not be verified and were retained.' }
Remove-Item -LiteralPath $pidFile
