[CmdletBinding()]
param(
    [ValidateSet('frontend', 'api-gateway', 'auth-service', 'user-service')][string[]]$Service = @('frontend', 'api-gateway', 'auth-service', 'user-service'),
    [ValidateRange(0, 100000)][int]$Tail = 200,
    [switch]$ErrorsOnly,
    [switch]$IncludeHealth,
    [switch]$Once,
    [ValidateRange(30, 1800)][int]$WaitTimeoutSeconds = 300,
    [Parameter(DontShow = $true)][switch]$InTerminal
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevTools.psm1') -Force
Assert-DevDocker
if (-not $InTerminal -and -not $Once) {
    $null = Open-DevTerminal -ScriptFile $PSCommandPath -Title 'Capstone - Request HTTP' -Parameters @{
        Service = $Service
        Tail = $Tail
        ErrorsOnly = [bool]$ErrorsOnly
        IncludeHealth = [bool]$IncludeHealth
        WaitTimeoutSeconds = $WaitTimeoutSeconds
    }
    Write-Output 'Terminal request HTTP dibuka.'
    return
}
Write-Output 'Request HTTP Docker | waktu WITA | Ctrl+C untuk keluar'
if (-not $Once) {
    Write-Output 'Menunggu request baru. Buka http://localhost:3000/login dan gunakan aplikasi.'
    $deadline = [DateTime]::UtcNow.AddSeconds($WaitTimeoutSeconds)
    $waiting = $false
    do {
        $active = @(Get-DevServiceStatus | Where-Object { $_.Layanan -in $Service -and $_.Status -eq 'Aktif' })
        if ($active.Count -eq @($Service | Select-Object -Unique).Count) { break }
        if (-not $waiting) { Write-Output 'Menunggu container berjalan...'; $waiting = $true }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Container belum berjalan. Periksa terminal status atau jalankan Start-Dev.ps1.' }
        Start-Sleep -Seconds 2
    } while ($true)
}
Write-Output 'WAKTU                HTTP METHOD  LAYANAN       PATH  DURASI'
$arguments = @('compose') + @(Get-DevComposeArguments) + @('logs', '--no-color', '--no-log-prefix', '--tail', "$Tail")
if (-not $Once) { $arguments += '--follow' }
$arguments += $Service
$requestCount = 0
& docker @arguments | ForEach-Object {
    $line = ConvertFrom-DevAccessLog -Line $_ -IncludeHealth:$IncludeHealth -ErrorsOnly:$ErrorsOnly
    if ($line) { $requestCount++; Write-Output $line }
}
if ($LASTEXITCODE -ne 0) { throw 'Log Docker tidak dapat dibaca. Periksa Docker Desktop dan status container.' }
if ($Once -and $requestCount -eq 0) { Write-Output 'Belum ada log request yang cocok.' }
elseif (-not $Once) { Write-Output 'Aliran log selesai. Jika container dibuat ulang, jalankan kembali Start-Dev.ps1.' }
