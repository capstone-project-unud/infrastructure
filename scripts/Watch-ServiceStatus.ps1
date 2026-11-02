[CmdletBinding()]
param(
    [ValidateRange(1, 60)][int]$RefreshSeconds = 10,
    [switch]$SkipFrontend,
    [switch]$Once
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevTools.psm1') -Force
$previousSnapshot = $null
do {
    $rows = @(Get-DevServiceStatus -SkipFrontend:$SkipFrontend)
    $snapshot = $rows | ConvertTo-Json -Compress
    if ($Once -or $snapshot -ne $previousSnapshot) {
        $now = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(8)).ToString('yyyy-MM-dd HH:mm:ss')
        Write-Output "Status layanan Docker | $now WITA"
        $rows | Format-Table -AutoSize | Out-String | Write-Output
        if ($null -eq $previousSnapshot) {
            if (-not $SkipFrontend) { Write-Output 'Aplikasi: http://localhost:3000/login' }
            Write-Output 'Log request ditampilkan pada terminal kedua yang dibuka otomatis.'
            if (-not $Once) { Write-Output "Memantau setiap $RefreshSeconds detik; tabel berikutnya muncul jika status berubah." }
            Write-Output 'Ctrl+C menutup pemantauan; layanan tetap berjalan.'
        }
        $previousSnapshot = $snapshot
    }
    if (-not $Once) { Start-Sleep -Seconds $RefreshSeconds }
} while (-not $Once)
