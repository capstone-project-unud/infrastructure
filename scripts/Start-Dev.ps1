param([switch]$SkipFrontend)
$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runDirectory = Join-Path $workspaceRoot 'infrastructure/.run'
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
$pidFile = Join-Path $runDirectory 'processes.json'
if (Test-Path -LiteralPath $pidFile) { throw 'A recorded session exists. Run Stop-Dev.ps1 before starting another.' }
$portsToCheck = @(8080, 8081, 8082)
if (-not $SkipFrontend) { $portsToCheck += 3000 }
foreach ($portToCheck in $portsToCheck) { if (Get-NetTCPConnection -LocalPort $portToCheck -State Listen -ErrorAction SilentlyContinue) { throw "Port $portToCheck is already in use. Stop that process before starting." } }
$processRecords = @()
try {
    foreach ($serviceName in @('auth-service', 'user-service', 'api-gateway')) {
        $serviceDirectory = Join-Path $workspaceRoot ('backend/' + $serviceName)
        if (-not (Test-Path -LiteralPath (Join-Path $serviceDirectory '.env'))) { throw 'Run python infrastructure/scripts/bootstrap.py first.' }
        Push-Location $serviceDirectory
        try { & go build -o bin/service.exe ./cmd/api; if ($LASTEXITCODE -ne 0) { throw "Build failed: $serviceName" } } finally { Pop-Location }
        $serviceProcess = Start-Process -FilePath (Join-Path $serviceDirectory 'bin/service.exe') -WorkingDirectory $serviceDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory "$serviceName.out.log") -RedirectStandardError (Join-Path $runDirectory "$serviceName.err.log")
        $serviceStart = Get-Process -Id $serviceProcess.Id
        $processRecords += @{ name = $serviceName; id = $serviceProcess.Id; path = (Join-Path $serviceDirectory 'bin/service.exe'); started_ticks = $serviceStart.StartTime.ToUniversalTime().Ticks.ToString() }
        $processRecords | ConvertTo-Json | Set-Content -LiteralPath $pidFile
    }
    foreach ($servicePort in @(8081, 8082, 8080)) {
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try { $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$servicePort/health" -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Milliseconds 500 }
        }
        if (-not $ready) { throw "Service on port $servicePort did not become ready. Inspect infrastructure/.run/*.err.log" }
    }
    & python (Join-Path $PSScriptRoot 'seed_admin.py')
    if ($LASTEXITCODE -ne 0) { throw 'Admin bootstrap failed.' }
    if (-not $SkipFrontend) {
        $nodeExecutable = (Get-Command node).Source
        $nodeVersion = [version]((& $nodeExecutable --version).TrimStart('v'))
        if ($nodeVersion -lt [version]'22.22.3') {
            $nodeExecutable = Join-Path $runDirectory 'node.exe'
            if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'Install Node 22.22.3+ or run Install-LocalNode.ps1.' }
        }
        $frontendDirectory = Join-Path $workspaceRoot 'frontend'
        if (-not (Test-Path -LiteralPath (Join-Path $frontendDirectory 'node_modules'))) { throw 'Run npm ci in frontend first.' }
        $oldDebug = $env:DEBUG
        $env:DEBUG = ''
        $env:NUXT_TELEMETRY_DISABLED = '1'
        try { $frontendProcess = Start-Process -FilePath $nodeExecutable -ArgumentList 'node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', 'localhost' -WorkingDirectory $frontendDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory 'frontend.out.log') -RedirectStandardError (Join-Path $runDirectory 'frontend.err.log') } finally { $env:DEBUG = $oldDebug }
        $frontendStart = Get-Process -Id $frontendProcess.Id
        $processRecords += @{ name = 'frontend'; id = $frontendProcess.Id; path = $nodeExecutable; started_ticks = $frontendStart.StartTime.ToUniversalTime().Ticks.ToString() }
        $processRecords | ConvertTo-Json | Set-Content -LiteralPath $pidFile
    }
    Write-Output 'Services started. Open http://localhost:3000/login after Nuxt is ready.'
} catch {
    & (Join-Path $PSScriptRoot 'Stop-Dev.ps1')
    throw
}
