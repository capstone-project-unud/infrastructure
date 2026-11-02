[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevTools.psm1') -Force
Assert-DevDocker
$compose = @(Get-DevComposeArguments)
& docker compose @compose down
if ($LASTEXITCODE -ne 0) { throw 'Container belum berhasil dihentikan. Periksa Docker Desktop.' }
Write-Output 'Container development dihentikan. Volume cache dan data Neon tetap tersimpan.'
