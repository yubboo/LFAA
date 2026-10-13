Describe 'LFAA Windows Web startup preflight' {
    It 'resolves the configured data directory under Windows PowerShell 5.1' {
        $scriptPath = Join-Path $PSScriptRoot '..\install-dependencies.ps1'
        $tokens = $null
        $parseErrors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile(
            $scriptPath,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0) {
            throw "install-dependencies.ps1 has PowerShell parse errors: $($parseErrors.Count)"
        }

        $resolverFunction = $ast.Find({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $node.Name -eq 'Get-ResolvedDataDirectory'
        }, $true)
        if ($null -eq $resolverFunction) {
            throw 'Get-ResolvedDataDirectory was not found in install-dependencies.ps1.'
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
}
