Describe 'Get-BlockedGitPaths first-party credentials package boundary' {
    BeforeAll {
        $scriptPath = Join-Path $PSScriptRoot '..\install-dependencies.ps1'
        $tokens = $null
        $parseErrors = $null
        $scriptAst = [System.Management.Automation.Language.Parser]::ParseFile(
            $scriptPath,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0) {
            throw "install-dependencies.ps1 has PowerShell parse errors: $($parseErrors.Count)"
        }

        $functionAst = $scriptAst.Find({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $node.Name -eq 'Get-BlockedGitPaths'
        }, $true)
        if (-not $functionAst) {
            throw 'Get-BlockedGitPaths was not found in install-dependencies.ps1.'
        }

        . ([scriptblock]::Create($functionAst.Extent.Text))
    }

    It 'allows the package tree object and normal source files' {
        $blocked = @(Get-BlockedGitPaths -Paths @(
            'packages/credentials',
            'packages/credentials/authorization/src/middleware.ts',
            'packages/credentials/credential-flows/package.json'
        ))

        if ($blocked.Count -ne 0) {
            throw "First-party source paths were blocked: $($blocked -join ', ')"
        }
    }

    It 'continues to block other credentials directories and sensitive files inside the package' {
        $blocked = @(Get-BlockedGitPaths -Paths @(
            'data/credentials',
            'packages/other/credentials/config.json',
            'packages/credentials/private.pem',
            'packages/credentials/credentials.json'
        ))

        foreach ($expected in @(
            'data/credentials',
            'packages/other/credentials/config.json',
            'packages/credentials/private.pem',
            'packages/credentials/credentials.json'
        )) {
            if ($blocked -notcontains $expected) {
                throw "Sensitive path was not blocked: $expected"
            }
        }
    }

    It 'blocks the active custom data root while leaving ordinary project source eligible' {
        $projectRoot = Join-Path $env:TEMP 'lfaa-custom-data-root-guard-fixture'
        $customDataRoot = Join-Path $projectRoot 'private-store\instance data'
        $blocked = @(Get-BlockedGitPaths -Paths @(
            'packages/client/src/index.ts',
            'private-store/instance data/database/lfaa.sqlite',
            'private-store/instance data/users/profile.json'
        ) -DataRoot $customDataRoot)

        if ($blocked.Count -ne 2 -or $blocked -contains 'packages/client/src/index.ts') {
            throw "Custom data-root filtering was incorrect: $($blocked -join ', ')"
        }
    }

    It 'blocks all repository paths if the configured data root contains the source checkout' {
        $projectRoot = Join-Path $env:TEMP 'lfaa-data-root-parent-guard-fixture\source'
        $dataRoot = Split-Path -Parent $projectRoot
        $blocked = @(Get-BlockedGitPaths -Paths @('packages/client/src/index.ts') -DataRoot $dataRoot)

        if ($blocked.Count -ne 1) {
            throw 'A data root containing the source checkout must stop every project path from being pushed.'
        }
    }
}
