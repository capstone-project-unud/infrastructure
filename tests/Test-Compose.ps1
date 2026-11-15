$ErrorActionPreference = 'Stop'
$infrastructure = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function Read-ComposeConfiguration {
    param([string[]]$Files)
    $arguments = @('compose')
    foreach ($file in $Files) { $arguments += '-f', (Join-Path $infrastructure $file) }
    $arguments += @('config', '--format', 'json', '--no-env-resolution', '--no-interpolate')
    $output = & docker @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Compose configuration invalid.' }
    $output | ConvertFrom-Json
}
$development = Read-ComposeConfiguration @('compose.yaml', 'compose.dev.yaml')
foreach ($name in @('auth-service', 'user-service', 'api-gateway', 'capstone-service', 'frontend')) {
    $service = $development.services.PSObject.Properties[$name].Value
    if (-not $service.build -or $service.pull_policy -ne 'never') { throw "Development image must build locally: $name" }
    if ($name -ne 'frontend' -and $service.ports) { throw "Backend port must stay private: $name" }
}
if ($development.services.frontend.ports[0].host_ip -ne '127.0.0.1') { throw 'Frontend development port must bind to loopback.' }
if ($development.services.redis.ports) { throw 'Development Redis port must stay private.' }
$verification = Read-ComposeConfiguration @('compose.verify.yaml')
foreach ($entry in $verification.services.PSObject.Properties) {
    if (-not $entry.Value.healthcheck) { throw "Verification health check missing: $($entry.Name)" }
    foreach ($envFile in $entry.Value.env_file) {
        if (-not $envFile.path.Replace('\', '/').EndsWith('/.run/verify.env')) { throw 'Verification services must use generated test configuration.' }
    }
}
if ($verification.services.'capstone-service'.environment.STORAGE_DRIVER -ne 'local') { throw 'Verification must use temporary local storage.' }
if ($verification.services.postgres.ports -or $verification.services.redis.ports) { throw 'Verification database/cache ports must stay private.' }
Write-Output 'PASS: local dev image policy, private service ports, verification health checks and isolated configuration.'
