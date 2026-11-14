function Get-DevComposeArguments {
    @('-f', (Join-Path $PSScriptRoot '../compose.yaml'), '-f', (Join-Path $PSScriptRoot '../compose.dev.yaml'))
}

function Get-DevServices {
    param([switch]$SkipFrontend)
    $names = @('api-gateway', 'auth-service', 'user-service', 'capstone-service', 'redis')
    if (-not $SkipFrontend) { $names += 'frontend' }
    $names
}

function Invoke-DevDockerCapture {
    param([string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& docker @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    [pscustomobject]@{ ExitCode = $exitCode; Output = ($output -join "`n") }
}

function Assert-DevDocker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker tidak ditemukan. Pasang dan aktifkan Docker Desktop dengan Linux containers.' }
    $result = Invoke-DevDockerCapture -Arguments @('info', '--format', '{{.OSType}}')
    if ($result.ExitCode -ne 0) { throw 'Docker belum dapat diakses. Aktifkan Docker Desktop, lalu jalankan skrip kembali.' }
    if ($result.Output.Trim() -ne 'linux') { throw 'Pilih Linux containers pada Docker Desktop.' }
}

function Get-DevServiceStatus {
    param([switch]$SkipFrontend)
    $services = @(Get-DevServices -SkipFrontend:$SkipFrontend)
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        foreach ($name in $services) { [pscustomobject]@{ Layanan=$name; Status='Docker tidak ditemukan'; Health='-'; Proses='-' } }
        return
    }
    $arguments = @('compose') + @(Get-DevComposeArguments) + @('ps', '--all', '--format', 'json')
    $result = Invoke-DevDockerCapture -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        foreach ($name in $services) { [pscustomobject]@{ Layanan=$name; Status='Docker tidak dapat diakses'; Health='-'; Proses='-' } }
        return
    }
    $containers = @()
    $json = $result.Output.Trim()
    if ($json.StartsWith('[')) { $containers = @($json | ConvertFrom-Json) }
    elseif ($json) { $containers = @($json -split "`n" | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json }) }
    foreach ($name in $services) {
        $container = $containers | Where-Object { $_.Service -eq $name } | Select-Object -First 1
        if (-not $container) { [pscustomobject]@{ Layanan=$name; Status='Belum dibuat'; Health='-'; Proses='-' }; continue }
        $labels = @{ running='Aktif'; exited='Berhenti'; created='Dibuat'; restarting='Restart'; paused='Dijeda'; dead='Gagal'; removing='Dihapus' }
        $state = $labels[$container.State]
        if (-not $state) { $state = $container.State }
        $health = if ($container.Health) { $container.Health } else { '-' }
        [pscustomobject]@{ Layanan=$name; Status=$state; Health=$health; Proses=$container.Name }
    }
}

function ConvertFrom-DevAccessLog {
    param([string]$Line, [switch]$IncludeHealth, [switch]$ErrorsOnly)
    if (-not $Line.StartsWith('{')) { return }
    try { $entry = $Line | ConvertFrom-Json -ErrorAction Stop } catch { return }
    if ($entry.access_log -ne $true -or $entry.service -notin @('frontend','api-gateway','auth-service','user-service','capstone-service')) { return }
    if (-not $IncludeHealth -and $entry.path -eq '/health') { return }
    $statusCode = 0
    $date = [DateTimeOffset]::MinValue
    if (-not [int]::TryParse([string]$entry.status, [ref]$statusCode) -or $statusCode -lt 100 -or $statusCode -gt 599) { return }
    if (-not [DateTimeOffset]::TryParse([string]$entry.time, [ref]$date)) { return }
    if ($ErrorsOnly -and $statusCode -lt 400) { return }
    $timestamp = $date.ToOffset([TimeSpan]::FromHours(8)).ToString('HH:mm:ss.fff')
    $path = [regex]::Replace([string]$entry.path, '[\x00-\x1f\x7f-\x9f]', '?')
    '{0} WITA  {1,3}  {2,-7} {3,-13} {4}  {5}' -f $timestamp, $entry.status, $entry.method, $entry.service, $path, ([string]$entry.duration).Trim()
}

Export-ModuleMember -Function Get-DevComposeArguments, Get-DevServices, Invoke-DevDockerCapture, Assert-DevDocker, Get-DevServiceStatus, ConvertFrom-DevAccessLog
