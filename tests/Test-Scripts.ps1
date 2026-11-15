$ErrorActionPreference = 'Stop'
$paths = @((Join-Path $PSScriptRoot '../scripts'), $PSScriptRoot)
$count = 0
foreach ($directory in $paths) {
    foreach ($file in Get-ChildItem -LiteralPath $directory -File | Where-Object { $_.Extension -in @('.ps1', '.psm1') }) {
        $tokens = $null
        $parseErrors = $null
        [void][Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$parseErrors)
        if ($parseErrors.Count) {
            $parseErrors | ForEach-Object { Write-Output ($file.Name + ': ' + $_.Message) }
            throw 'PowerShell syntax check failed.'
        }
        $count++
    }
}
Write-Output "PASS: $count PowerShell files parsed."
