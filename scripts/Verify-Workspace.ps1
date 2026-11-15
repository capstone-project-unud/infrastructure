[CmdletBinding()]
param(
    [switch]$Integration,
    [string]$NodeExecutable = 'node'
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runDir = Join-Path $root 'infrastructure/.run'
$node = (Get-Command $NodeExecutable -ErrorAction Stop).Source
if (-not (Get-Command go -ErrorAction SilentlyContinue)) { throw 'Pasang Go sesuai go.mod untuk pengujian workspace.' }
New-Item -ItemType Directory -Force (Join-Path $runDir 'bin') | Out-Null
Import-Module (Join-Path $PSScriptRoot 'VerificationTools.psm1') -Force
$previousCache = $env:GOCACHE
try {
    $env:GOCACHE = Join-Path $runDir 'go-build'
    & (Join-Path $root 'infrastructure/tests/Test-DevTools.ps1')
    & (Join-Path $root 'infrastructure/tests/Test-VerificationCommands.ps1')
    foreach ($service in @('auth-service', 'user-service', 'capstone-service', 'api-gateway')) {
        Push-Location (Join-Path $root "backend/$service")
        try {
            Write-Output "Memeriksa $service..."
            Invoke-VerificationCommand go @('test', '-buildvcs=false', '-count=1', './...')
            Invoke-VerificationCommand go @('vet', '-buildvcs=false', './...')
            $suffix = if ($env:OS -eq 'Windows_NT') { '.exe' } else { '' }
            Invoke-VerificationCommand go @('build', '-buildvcs=false', '-o', (Join-Path $runDir "bin/$service$suffix"), './cmd/api')
        } finally { Pop-Location }
    }
    Push-Location (Join-Path $root 'frontend')
    try {
        if (-not (Test-Path -LiteralPath 'node_modules/nuxt/bin/nuxt.mjs')) { throw 'Jalankan npm ci dari frontend dengan Node sesuai .node-version terlebih dahulu.' }
        Invoke-VerificationCommand $node @('--experimental-strip-types', '--test', 'tests/calendar.test.ts')
        Invoke-VerificationCommand $node @('node_modules/nuxt/bin/nuxt.mjs', 'typecheck')
        Invoke-VerificationCommand $node @('node_modules/nuxt/bin/nuxt.mjs', 'build')
    } finally { Pop-Location }
} finally { $env:GOCACHE = $previousCache }
if (-not $Integration) { Write-Output 'PASS: unit tests, vet, backend builds, frontend typecheck and production build.'; return }

Import-Module (Join-Path $PSScriptRoot 'DevTools.psm1') -Force
Assert-DevDocker
& (Join-Path $root 'infrastructure/tests/Test-Compose.ps1')
$compose = @('compose', '-p', 'capstone-verify', '-f', (Join-Path $root 'infrastructure/compose.verify.yaml'))
$existing = Invoke-DevDockerCapture -Arguments @('ps', '-aq', '--filter', 'label=com.docker.compose.project=capstone-verify')
if ($existing.ExitCode -ne 0) { throw 'Container pengujian belum dapat diperiksa.' }
if ($existing.Output.Trim()) { throw 'Stack capstone-verify masih ada. Hentikan stack uji dengan docker compose -p capstone-verify -f infrastructure/compose.verify.yaml down -v sebelum mengulang.' }
$architecture = Invoke-DevDockerCapture -Arguments @('info', '--format', '{{.Architecture}}')
if ($architecture.ExitCode -ne 0) { throw 'Arsitektur Docker belum dapat dibaca.' }
$arch = switch ($architecture.Output.Trim()) { 'x86_64' { 'amd64' } 'amd64' { 'amd64' } 'aarch64' { 'arm64' } 'arm64' { 'arm64' } default { throw 'Arsitektur Docker belum didukung runner verifikasi.' } }
& (Join-Path $PSScriptRoot 'Prepare-Verification.ps1') -Architecture $arch
$server = $null
$started = $false
$previousEnvironment = @{}
foreach ($key in @('NUXT_GATEWAY_URL', 'HOST', 'PORT', 'FRONTEND_URL', 'VERIFY_API_URL', 'VERIFY_ORIGIN')) { $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
    $env:VERIFY_API_URL = 'http://127.0.0.1:18080'
    $env:VERIFY_ORIGIN = 'http://127.0.0.1:13000'
    $started = $true
    Invoke-VerificationCommand docker ($compose + @('up', '--detach', '--wait', '--wait-timeout', '180'))
    Invoke-VerificationCommand $node @((Join-Path $PSScriptRoot 'capstone_smoke.mjs'))
    $env:NUXT_GATEWAY_URL = 'http://127.0.0.1:18080'
    $env:HOST = '127.0.0.1'
    $env:PORT = '13000'
    $env:FRONTEND_URL = 'http://127.0.0.1:13000'
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 13000)
    try { $listener.Start() } finally { $listener.Stop() }
    $launch = @{
        FilePath=$node
        ArgumentList=@('"' + (Join-Path $root 'frontend/.output/server/index.mjs') + '"')
        WorkingDirectory=(Join-Path $root 'frontend')
        PassThru=$true
        RedirectStandardOutput=(Join-Path $runDir 'verify-ssr.out.log')
        RedirectStandardError=(Join-Path $runDir 'verify-ssr.err.log')
    }
    if ($env:OS -eq 'Windows_NT') { $launch.WindowStyle = 'Hidden' }
    $server = Start-Process @launch
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($server.HasExited) { throw 'Server SSR uji berhenti. Periksa infrastructure/.run/verify-ssr.err.log.' }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$env:FRONTEND_URL/login" -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Server SSR uji belum siap pada port 13000.' }
    Invoke-VerificationCommand $node @((Join-Path $PSScriptRoot 'capstone_frontend_smoke.mjs'))
    Write-Output 'PASS: API academic workflows and SSR pages across roles on isolated PostgreSQL/Redis.'
} finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue }
    foreach ($key in $previousEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process') }
    if ($started) {
        $cleanup = Invoke-DevDockerCapture -Arguments ($compose + @('down', '--volumes'))
        if ($cleanup.ExitCode -ne 0) { Write-Warning 'Stack capstone-verify belum terhapus. Hentikan hanya project uji tersebut sebelum mengulang.' }
        else { Write-Output 'Stack capstone-verify dibersihkan; container development tetap berjalan.' }
    }
}
