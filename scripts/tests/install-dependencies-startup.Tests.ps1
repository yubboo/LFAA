Describe 'LFAA Windows Web startup preflight' {
    function Get-StartupScriptFunctionText {
        param([string]$Name)

        $scriptPath = Join-Path $PSScriptRoot '..\lfaa-web-startup-preflight.ps1'
        $tokens = $null
        $parseErrors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile(
            $scriptPath,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0) {
            throw "lfaa-web-startup-preflight.ps1 has PowerShell parse errors: $($parseErrors.Count)"
        }

        $function = $ast.Find({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $node.Name -eq $Name
        }, $true)
        if ($null -eq $function) {
            throw "$Name was not found in lfaa-web-startup-preflight.ps1."
        }
        return $function.Extent.Text
    }

    It 'resolves the configured data directory under Windows PowerShell 5.1' {
        $scriptPath = Join-Path $PSScriptRoot '..\lfaa-web-startup-preflight.ps1'
        $tokens = $null
        $parseErrors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile(
            $scriptPath,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0) {
            throw "lfaa-web-startup-preflight.ps1 has PowerShell parse errors: $($parseErrors.Count)"
        }

        $resolverFunction = $ast.Find({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $node.Name -eq 'Get-ResolvedDataDirectory'
        }, $true)
        if ($null -eq $resolverFunction) {
            throw 'Get-ResolvedDataDirectory was not found in lfaa-web-startup-preflight.ps1.'
        }

        $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
        $expectedDataDirectory = [System.IO.Path]::GetFullPath(
            (Join-Path $env:TEMP 'lfaa-startup-directory-regression')
        )
        $previousDataDirectory = [Environment]::GetEnvironmentVariable('LFAA_DATA_DIR', 'Process')

        try {
            $env:LFAA_DATA_DIR = $expectedDataDirectory
            . ([ScriptBlock]::Create($resolverFunction.Extent.Text))
            (Get-ResolvedDataDirectory) | Should Be $expectedDataDirectory
        }
        finally {
            if ($null -eq $previousDataDirectory) {
                Remove-Item Env:\LFAA_DATA_DIR -ErrorAction SilentlyContinue
            }
            else {
                $env:LFAA_DATA_DIR = $previousDataDirectory
            }
        }
    }

    It 'recognizes the packaged LFAA web CLI and the aligned TypeScript source CLI' {
        . ([ScriptBlock]::Create((Get-StartupScriptFunctionText 'Test-LfaaWebLockOwnerCommand')))

        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node apps/cli/bin/lfaa.mjs web') | Should Be $true
        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node --import tsx/esm --import ./apps/cli/register-package-loader.mjs apps/cli/src/bin.ts web') | Should Be $true
        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node --import tsx/esm --import ./apps/cli/register-package-loader.mjs apps/cli/src/bin.ts "web"') | Should Be $true
        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node apps/cli/bin/lfaa.mjs "web"') | Should Be $true
        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node --import tsx --import ./register-package-loader.mjs src/index.ts --profile web') | Should Be $true
    }

    It 'rejects DSH, other profiles, and unrelated Node processes' {
        . ([ScriptBlock]::Create((Get-StartupScriptFunctionText 'Test-LfaaWebLockOwnerCommand')))

        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node --import tsx/esm apps/cli/src/bin.ts web') | Should Be $false
        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node --import tsx --import ./apps/cli/register-package-loader.mjs apps/cli/src/bin.ts daemon') | Should Be $false
        (Test-LfaaWebLockOwnerCommand -Name 'node.exe' -CommandLine 'node unrelated.js web') | Should Be $false
        (Test-LfaaWebLockOwnerCommand -Name 'bun.exe' -CommandLine 'node apps/cli/bin/lfaa.mjs web') | Should Be $false
    }
}
