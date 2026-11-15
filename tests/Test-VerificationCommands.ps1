$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../scripts/VerificationTools.psm1') -Force
$executable = (Get-Process -Id $PID).Path
$warningCode = "[Console]::Error.WriteLine('verification warning'); exit 0"
$output = @(Invoke-VerificationCommand $executable @('-NoLogo', '-NoProfile', '-NonInteractive', '-Command', $warningCode) 2>&1)
if (($output -join "`n") -notmatch 'verification warning') { throw 'Native warning must remain visible without terminating a successful command.' }
$failedCode = 'exit 7'
$caught = $false
try { Invoke-VerificationCommand $executable @('-NoLogo', '-NoProfile', '-NonInteractive', '-Command', $failedCode) | Out-Null }
catch { $caught = $_.Exception.Message -match 'exit 7' }
if (-not $caught) { throw 'A nonzero native exit must fail verification.' }
if ($ErrorActionPreference -ne 'Stop') { throw 'The caller error preference must be preserved.' }
Write-Output 'PASS: native stderr with exit 0 continues; exit 7 fails; caller error preference is preserved.'
$global:LASTEXITCODE = 0
