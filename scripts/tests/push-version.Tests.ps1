Describe 'GitHub source push version tracking' {
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

        foreach ($name in @('Get-CommitMessageVersion', 'Test-PushVersionIsNewer', 'Resolve-LastPushedVersion')) {
            $functionAst = $scriptAst.Find({
                param($node)
                $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                    $node.Name -eq $name
            }, $true)
            if (-not $functionAst) {
                throw "$name was not found in install-dependencies.ps1."
            }

            . ([scriptblock]::Create($functionAst.Extent.Text))
        }
    }

    It 'reads a version at the start of a source commit message' {
        (Get-CommitMessageVersion -CommitMessage '0.0.24') | Should Be '0.0.24'
        (Get-CommitMessageVersion -CommitMessage 'LFAA 0.0.25: 修复插件安装') | Should Be '0.0.25'
        (Get-CommitMessageVersion -CommitMessage '修复插件安装 0.0.25') | Should Be ''
    }

    It 'uses the newest version commit found in remote main history' {
        $result = Resolve-LastPushedVersion -RemoteCommitSubjects @(
            'Merge pull request #42',
            '0.0.24',
            '0.0.23'
        ) -LocalVersion '0.0.20'

        $result.Number | Should Be '0.0.24'
        $result.Source | Should Be 'GitHub main 最近的版本提交'
    }

    It 'uses the local successful push record only when history has no version commit' {
        $result = Resolve-LastPushedVersion -RemoteCommitSubjects @('maintenance update') -LocalVersion '0.0.24'
        $result.Number | Should Be '0.0.24'
        $result.Source | Should Be '本机最近一次成功推送记录'
    }

    It 'compares numeric version parts and requires a strictly newer version' {
        (Test-PushVersionIsNewer -Candidate '0.0.22' -Previous '0.0.24') | Should Be $false
        (Test-PushVersionIsNewer -Candidate '0.0.24' -Previous '0.0.24') | Should Be $false
        (Test-PushVersionIsNewer -Candidate '0.0.100' -Previous '0.0.55') | Should Be $true
    }
}
