[CmdletBinding()]
param(
    [switch]$Build,
    [switch]$SkipFrontend,
    [switch]$NoWatch,
    [ValidateRange(1, 60)][int]$RefreshSeconds = 10,
    [ValidateRange(30, 1800)][int]$WaitTimeoutSeconds = 300,
    [Parameter(DontShow = $true)][switch]$InTerminal
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevTools.psm1') -Force
Assert-DevDocker
if (-not $InTerminal -and -not $NoWatch) {
    $null = Open-DevTerminal -ScriptFile $PSCommandPath -Title 'Capstone - Status Container' -Parameters @{
        Build = [bool]$Build
        SkipFrontend = [bool]$SkipFrontend
        RefreshSeconds = $RefreshSeconds
        WaitTimeoutSeconds = $WaitTimeoutSeconds
    }
    Write-Output 'Terminal 1 dibuka untuk startup dan status container.'
    Write-Output 'Terminal 2 untuk request akan terbuka otomatis setelah layanan siap.'
    return
}
$compose = @(Get-DevComposeArguments)
$arguments = @('compose') + $compose + @('up', '--detach', '--wait', '--wait-timeout', "$WaitTimeoutSeconds")
if ($Build) { $arguments += '--build' }
$arguments += @(Get-DevServices -SkipFrontend:$SkipFrontend)
& docker @arguments
if ($LASTEXITCODE -ne 0) { throw 'Startup Docker gagal atau layanan belum healthy. Container dipertahankan untuk diagnosis. Jalankan Watch-ServiceStatus.ps1 -Once atau docker compose logs.' }
& docker compose @compose --profile init run --rm seed-admin
if ($LASTEXITCODE -ne 0) { throw 'Container sudah berjalan, tetapi penyiapan admin gagal. Periksa log dan konfigurasi .env.' }
Write-Output 'Docker development siap. Backend memakai Air; frontend memakai Nuxt dev server.'
if ($NoWatch) {
    & (Join-Path $PSScriptRoot 'Watch-ServiceStatus.ps1') -SkipFrontend:$SkipFrontend -Once
} else {
    & (Join-Path $PSScriptRoot 'Watch-Requests.ps1') -Service @(Get-DevServices -SkipFrontend:$SkipFrontend)
    & (Join-Path $PSScriptRoot 'Watch-ServiceStatus.ps1') -SkipFrontend:$SkipFrontend -RefreshSeconds $RefreshSeconds
}
