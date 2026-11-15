$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../scripts/DevTools.psm1') -Force
$module = Get-Module DevTools
& $module {
    $script:imagesMissing = @('capstone-project-service:dev')
    $script:configFailed = $false
    function script:Invoke-DevDockerCapture {
        param([string[]]$Arguments)
        if ($Arguments[0] -eq 'compose') {
            if ($script:configFailed) { return [pscustomobject]@{ ExitCode=1; Output='' } }
            $services = @{ redis=@{ image='redis:7.4-alpine' } }
            foreach ($name in @('auth-service','user-service','capstone-service','api-gateway','frontend')) {
                $tag = @{ 'auth-service'='auth-service'; 'user-service'='user-service'; 'capstone-service'='project-service'; 'api-gateway'='api-gateway'; 'frontend'='frontend' }[$name]
                $services[$name] = @{ image="capstone-${tag}:dev"; build=@{ context='local-source' } }
            }
            return [pscustomobject]@{ ExitCode=0; Output=(@{ services=$services } | ConvertTo-Json -Depth 5 -Compress) }
        }
        [pscustomobject]@{ ExitCode=$(if ($Arguments[2] -in $script:imagesMissing) { 1 } else { 0 }); Output='' }
    }
}
try {
    if ((@(Get-DevBuildServices) -join ',') -ne 'capstone-service') { throw 'Build harus memilih hanya image yang hilang.' }
    if (@(Get-DevBuildServices -Rebuild).Count -ne 5) { throw 'Build eksplisit harus mencakup lima aplikasi.' }
    if (@(Get-DevBuildServices -Rebuild -SkipFrontend).Count -ne 4) { throw 'SkipFrontend harus dipatuhi.' }
    & $module { $script:imagesMissing = @() }
    if (@(Get-DevBuildServices).Count) { throw 'Image tersedia tidak perlu dibangun ulang.' }
    & $module { $script:configFailed = $true }
    $caught = $false
    try { Get-DevBuildServices | Out-Null } catch { $caught = $true }
    if (-not $caught) { throw 'Konfigurasi gagal harus menghentikan startup.' }
    & $module {
        $script:configFailed = $false
        $script:missingEnv = $false
        function script:Test-Path {
            param([string]$LiteralPath, [string]$PathType)
            -not ($script:missingEnv -and $LiteralPath.Replace('\', '/').EndsWith('backend/capstone-service/.env'))
        }
    }
    Assert-DevConfiguration
    & $module { $script:missingEnv = $true }
    $caught = $false
    try { Assert-DevConfiguration } catch { $caught = $_.Exception.Message -match 'backend/capstone-service/.env' }
    if (-not $caught) { throw 'Konfigurasi yang hilang harus dilaporkan sebelum startup.' }
    if (@(Get-DevServices).Count -ne 6 -or @(Get-DevServices -SkipFrontend).Count -ne 5) { throw 'Daftar layanan tidak lengkap.' }
    $entry = @{ access_log=$true; service='capstone-service'; path='/api/v1/capstone/projects'; status=403; method='GET'; time='2026-11-15T00:00:00Z'; duration='1ms' } | ConvertTo-Json -Compress
    $line = ConvertFrom-DevAccessLog -Line $entry -ErrorsOnly
    if ($line -notmatch '08:00:00.000 WITA.*403.*capstone-service') { throw 'Log tidak memuat layanan/status/waktu WITA.' }
    if (ConvertFrom-DevAccessLog -Line '{"password":"secret"}') { throw 'Log non-access tidak boleh dicetak.' }
    Write-Output 'PASS: missing image, cache, rebuild, SkipFrontend, invalid/missing configuration, six services, and filtered access logs.'
} finally { Import-Module (Join-Path $PSScriptRoot '../scripts/DevTools.psm1') -Force }
