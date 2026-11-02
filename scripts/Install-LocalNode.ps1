$ErrorActionPreference = 'Stop'
$runDirectory = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path '.run'
New-Item -ItemType Directory -Force -Path $runDirectory | Out-Null
$nodeExecutable = Join-Path $runDirectory 'node.exe'
$version = '22.22.3'
$baseUrl = "https://nodejs.org/dist/v$version"
$hashes = (Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt").Content
$expectedHash = (($hashes -split "`n" | Where-Object { $_ -match '\swin-x64/node.exe\s*$' }) -split '\s+')[0]
if (-not $expectedHash) { throw 'Could not locate official Node checksum.' }
Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/win-x64/node.exe" -OutFile $nodeExecutable
$actualHash = (Get-FileHash -LiteralPath $nodeExecutable -Algorithm SHA256).Hash
if ($actualHash.ToLowerInvariant() -ne $expectedHash.ToLowerInvariant()) { Remove-Item -LiteralPath $nodeExecutable; throw 'Node checksum mismatch.' }
& $nodeExecutable --version
