function Invoke-VerificationCommand {
    param([string]$Executable, [string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments 2>&1 | ForEach-Object { Write-Output $_.ToString() }
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($exitCode -ne 0) { throw "Pemeriksaan gagal (exit $exitCode): $Executable $($Arguments -join ' ')" }
}

Export-ModuleMember -Function Invoke-VerificationCommand
