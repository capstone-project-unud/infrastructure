[CmdletBinding()]
param([ValidateSet('amd64', 'arm64')][string]$Architecture = 'amd64')
$ErrorActionPreference = 'Stop'
if (-not (Get-Command go -ErrorAction SilentlyContinue)) { throw 'Go sesuai go.mod diperlukan untuk menyiapkan binary pengujian.' }
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$verifyDir = Join-Path $root 'infrastructure/.run/verify'
New-Item -ItemType Directory -Force $verifyDir | Out-Null
function New-VerificationSecret { $bytes = New-Object byte[] 32; $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose(); ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant() }
$password = New-VerificationSecret
$authToken = New-VerificationSecret
$userToken = New-VerificationSecret
$values = @(
 'POSTGRES_USER=verify', 'POSTGRES_DB=verify', "POSTGRES_PASSWORD=$password",
 "DATABASE_URL=postgresql://verify:${password}@postgres:5432/verify?sslmode=disable",
 "AUTH_INTERNAL_TOKEN=$authToken", "USER_INTERNAL_TOKEN=$userToken",
 'AUTH_SERVICE_URL=http://auth-service:8081', 'USER_SERVICE_URL=http://user-service:8082',
 'CAPSTONE_SERVICE_URL=http://capstone-service:8083', 'COOKIE_SECURE=false'
)
[IO.File]::WriteAllLines((Join-Path $root 'infrastructure/.run/verify.env'), $values)
$sql = @('BEGIN;', 'CREATE SCHEMA auth_service;', 'CREATE SCHEMA user_service;', 'CREATE SCHEMA capstone_service;')
foreach ($service in @('auth-service', 'user-service', 'capstone-service')) {
 $schema = $service.Replace('-', '_')
 $sql += "CREATE TABLE $schema.schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());"
 $migrations = @(Get-ChildItem -LiteralPath (Join-Path $root "backend/$service/migrations") -Filter '*.sql' | Sort-Object Name)
 if (-not $migrations.Count) { throw "Migrasi tidak ditemukan: $service" }
 foreach ($migration in $migrations) {
  $content = [IO.File]::ReadAllText($migration.FullName).Replace("`r`n", "`n")
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $checksum = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($content)))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
  $name = $migration.Name.Replace("'", "''")
  $sql += $content, "INSERT INTO $schema.schema_migrations(version,checksum) VALUES('$name','$checksum');"
 }
}
$sql += 'COMMIT;'
[IO.File]::WriteAllText((Join-Path $verifyDir 'init.sql'), ($sql -join "`n"))
$previous = @{}
foreach ($name in @('GOOS', 'GOARCH', 'CGO_ENABLED', 'GOCACHE')) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$env:GOOS='linux'; $env:GOARCH=$Architecture; $env:CGO_ENABLED='0'
try {
 foreach ($service in @('auth-service', 'user-service', 'capstone-service', 'api-gateway')) {
  Push-Location (Join-Path $root "backend/$service")
  try {
   $env:GOCACHE=Join-Path $root 'infrastructure/.run/go-build'
   & go build -buildvcs=false -o (Join-Path $verifyDir $service) ./cmd/api
   if ($LASTEXITCODE -ne 0) { throw "Build gagal: $service" }
  } finally { Pop-Location }
 }
} finally {
 foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
Write-Output 'Binary Linux dan database uji disiapkan. Konfigurasi hanya berada di infrastructure/.run.'
