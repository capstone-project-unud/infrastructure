$ErrorActionPreference = 'Stop'
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
$sql = @('CREATE SCHEMA auth_service;', 'CREATE SCHEMA user_service;', 'CREATE SCHEMA capstone_service;')
foreach ($service in @('auth-service', 'user-service', 'capstone-service')) {
 foreach ($migration in Get-ChildItem -LiteralPath (Join-Path $root "backend/$service/migrations") -Filter '*.sql' | Sort-Object Name) { $sql += [IO.File]::ReadAllText($migration.FullName) }
}
[IO.File]::WriteAllText((Join-Path $verifyDir 'init.sql'), ($sql -join "`n"))
$env:GOOS='linux'; $env:GOARCH='amd64'; $env:CGO_ENABLED='0'
try {
 foreach ($service in @('auth-service', 'user-service', 'capstone-service', 'api-gateway')) {
  Push-Location (Join-Path $root "backend/$service")
  try {
   $env:GOCACHE=Join-Path $root 'infrastructure/.run/go-build'
   & go build -buildvcs=false -o (Join-Path $verifyDir $service) ./cmd/api
   if ($LASTEXITCODE -ne 0) { throw "Build gagal: $service" }
  } finally { Pop-Location }
 }
} finally { Remove-Item Env:GOOS,Env:GOARCH,Env:CGO_ENABLED -ErrorAction SilentlyContinue }
Write-Output 'Binary Linux dan database uji disiapkan. Konfigurasi hanya berada di infrastructure/.run.'
