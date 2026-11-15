[CmdletBinding()]
param(
    [switch]$Build,
    [switch]$SkipFrontend,
    [switch]$NoWatch,
    [ValidateRange(1, 60)][int]$RefreshSeconds = 10,
    [ValidateRange(30, 1800)][int]$WaitTimeoutSeconds = 300
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevTools.psm1') -Force
Assert-DevDocker
Write-Output 'Menjalankan Docker development...'
$compose = @(Get-DevComposeArguments)
$buildServices = @(Get-DevBuildServices -Rebuild:$Build -SkipFrontend:$SkipFrontend)
if ($buildServices.Count) {
    Write-Output ('Membangun image lokal: ' + ($buildServices -join ', '))
    & docker compose --progress plain @compose build @buildServices
    if ($LASTEXITCODE -ne 0) { throw 'Build image development gagal. Periksa koneksi unduhan base image atau log build di atas.' }
}
$arguments = @('compose', '--progress', 'plain') + $compose + @('up', '--no-build', '--detach', '--wait', '--wait-timeout', "$WaitTimeoutSeconds")
$arguments += @(Get-DevServices -SkipFrontend:$SkipFrontend)
& docker @arguments
if ($LASTEXITCODE -ne 0) { throw 'Startup Docker gagal atau layanan belum healthy. Container dipertahankan untuk diagnosis. Jalankan Watch-ServiceStatus.ps1 -Once atau docker compose logs.' }
& docker compose --progress plain @compose --profile init run --rm --no-deps seed-admin
if ($LASTEXITCODE -ne 0) { throw 'Container sudah berjalan, tetapi penyiapan admin gagal. Periksa log dan konfigurasi .env.' }
Write-Output 'Docker development siap. Backend memakai Air; frontend memakai Nuxt dev server.'
if ($NoWatch) {
    & (Join-Path $PSScriptRoot 'Watch-ServiceStatus.ps1') -SkipFrontend:$SkipFrontend -Once
} else {
    & (Join-Path $PSScriptRoot 'Watch-ServiceStatus.ps1') -SkipFrontend:$SkipFrontend -RefreshSeconds $RefreshSeconds
}
