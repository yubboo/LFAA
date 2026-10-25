Describe 'GitHub source push version tracking' {
    BeforeAll {
        $functionPaths = @{
            'Get-CommitMessageVersion' = Join-Path $PSScriptRoot '..\source-version.ps1'
            'Resolve-LastPushedVersion' = Join-Path $PSScriptRoot '..\source-version.ps1'
            'Test-PushVersionIsNewer' = Join-Path $PSScriptRoot '..\install-dependencies.ps1'
            'Remove-StaleGitIndexLock' = Join-Path $PSScriptRoot '..\install-dependencies.ps1'
        }

        foreach ($name in @('Get-CommitMessageVersion', 'Test-PushVersionIsNewer', 'Resolve-LastPushedVersion', 'Remove-StaleGitIndexLock')) {
            $scriptPath = $functionPaths[$name]
            $tokens = $null
            $parseErrors = $null
            $scriptAst = [System.Management.Automation.Language.Parser]::ParseFile(
                $scriptPath,
                [ref]$tokens,
                [ref]$parseErrors
            )
            if ($parseErrors.Count -gt 0) {
                throw "$(Split-Path -Leaf $scriptPath) has PowerShell parse errors: $($parseErrors.Count)"
            }

            $functionAst = $scriptAst.Find({
                param($node)
                $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                    $node.Name -eq $name
            }, $true)
            if (-not $functionAst) {
                throw "$name was not found in $(Split-Path -Leaf $scriptPath)."
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

    It 'does nothing when the Git index lock is absent' {
        $missingLock = Join-Path ([System.IO.Path]::GetTempPath()) ("lfaa-index-lock-missing-{0}" -f [guid]::NewGuid().ToString('N'))
        (Remove-StaleGitIndexLock -GitIndexLockPath $missingLock) | Should Be $false
    }

    It 'removes an old index lock only when it can be opened exclusively' {
        $lockPath = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::SetLastWriteTimeUtc($lockPath, [System.DateTime]::UtcNow.AddMinutes(-11))

            (Remove-StaleGitIndexLock -GitIndexLockPath $lockPath) | Should Be $true
            (Test-Path -LiteralPath $lockPath) | Should Be $false
        }
        finally {
            if (Test-Path -LiteralPath $lockPath) { [System.IO.File]::Delete($lockPath) }
        }
    }

    It 'preserves a recently written index lock and explains that it is too new' {
        $lockPath = [System.IO.Path]::GetTempFileName()
        try {
            $message = ''
            try {
                Remove-StaleGitIndexLock -GitIndexLockPath $lockPath | Out-Null
            }
            catch {
                $message = $_.Exception.Message
            }

            $message | Should Match '较新的 Git 索引锁'
            (Test-Path -LiteralPath $lockPath) | Should Be $true
        }
        finally {
            if (Test-Path -LiteralPath $lockPath) { [System.IO.File]::Delete($lockPath) }
        }
    }

    It 'preserves an old index lock that is still held open by another process' {
        $lockPath = [System.IO.Path]::GetTempFileName()
        $lockStream = $null
        try {
            [System.IO.File]::SetLastWriteTimeUtc($lockPath, [System.DateTime]::UtcNow.AddMinutes(-11))
            $lockStream = [System.IO.File]::Open(
                $lockPath,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::ReadWrite,
                [System.IO.FileShare]::ReadWrite
            )

            $message = ''
            try {
                Remove-StaleGitIndexLock -GitIndexLockPath $lockPath | Out-Null
            }
            catch {
                $message = $_.Exception.Message
            }

            $message | Should Match '仍被进程占用'
            (Test-Path -LiteralPath $lockPath) | Should Be $true
        }
        finally {
            if ($null -ne $lockStream) { $lockStream.Dispose() }
            if (Test-Path -LiteralPath $lockPath) { [System.IO.File]::Delete($lockPath) }
        }
    }

    It 'checks the stale lock before staging and committing in menu 6' {
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

        $pushFunction = $scriptAst.Find({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $node.Name -eq 'Push-GitHubRepository'
        }, $true)
        if ($null -eq $pushFunction) {
            throw 'Push-GitHubRepository was not found in install-dependencies.ps1.'
        }

        $pushSource = $pushFunction.Extent.Text
        $addLockCheckPosition = $pushSource.IndexOf('[void](Remove-StaleGitIndexLock -GitIndexLockPath $gitIndexLockPath)')
        $commitLockCheckPosition = $pushSource.LastIndexOf('[void](Remove-StaleGitIndexLock -GitIndexLockPath $gitIndexLockPath)')
        $addPosition = $pushSource.IndexOf("Invoke-GitChecked -GitArguments @('add', '-A')")
        $commitPosition = $pushSource.IndexOf("Invoke-GitChecked -GitArguments @('commit', '-m', `$commitMessage)")

        ($addLockCheckPosition -ge 0 -and
            $addLockCheckPosition -lt $addPosition -and
            $commitLockCheckPosition -gt $addLockCheckPosition -and
            $commitLockCheckPosition -lt $commitPosition) | Should Be $true
    }
}
