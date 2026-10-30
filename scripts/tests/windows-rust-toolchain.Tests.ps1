Describe 'LFAA Windows Rust toolchain cache bootstrap' {
    $scriptPath = Join-Path $PSScriptRoot '..\windows-rust-toolchain.ps1'
    . $scriptPath

    It 'uses the official Rustup distribution URLs for supported Windows hosts' {
        (Get-LfaaRustupInstallerUri -HostTriple 'x86_64-pc-windows-msvc') | Should Be 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
        (Get-LfaaRustupInstallerUri -HostTriple 'aarch64-pc-windows-msvc') | Should Be 'https://static.rust-lang.org/rustup/dist/aarch64-pc-windows-msvc/rustup-init.exe'
    }

    It 'accepts a SHA-256 checksum and rejects malformed official metadata' {
        (Get-LfaaRustupSha256 -Text 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd  rustup-init.exe') | Should Be 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        $rejected = $false
        try { Get-LfaaRustupSha256 -Text 'not-a-checksum' | Out-Null }
        catch { $rejected = $true }
        $rejected | Should Be $true
    }

    It 'places Cargo and Rustup homes below the selected data cache' {
        $paths = Get-LfaaRustToolchainCachePaths -DataDirectory 'C:\lfaa-toolchain-test'
        $paths.Root | Should Be 'C:\lfaa-toolchain-test\cache\rust'
        $paths.CargoHome | Should Be 'C:\lfaa-toolchain-test\cache\rust\cargo'
        $paths.RustupHome | Should Be 'C:\lfaa-toolchain-test\cache\rust\rustup'
    }

    It 'downloads from the official source and accepts only a matching SHA-256' {
        $testRoot = Join-Path $env:TEMP ('lfaa-rustup-checksum-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
        $payloadPath = Join-Path $testRoot 'official-rustup-fixture.bin'
        Set-Content -LiteralPath $payloadPath -Value 'Rustup installer fixture' -Encoding ASCII -NoNewline
        $script:RustupFixtureHash = (Get-FileHash -LiteralPath $payloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $script:RustupFixturePayload = $payloadPath
        $paths = Get-LfaaRustToolchainCachePaths -DataDirectory $testRoot
        New-Item -ItemType Directory -Path $paths.Root -Force | Out-Null

        Mock Invoke-LfaaBoundedHttpsDownload {
            param([uri]$Uri, [string]$Destination, [long]$MaximumBytes)
            if ($Uri.AbsoluteUri -like '*.sha256') {
                Set-Content -LiteralPath $Destination -Value $script:RustupFixtureHash -Encoding ASCII -NoNewline
            }
            else {
                Copy-Item -LiteralPath $script:RustupFixturePayload -Destination $Destination
            }
        }

        try {
            $installerPath = Get-LfaaOfficialRustupInstaller -CachePaths $paths -HostTriple 'x86_64-pc-windows-msvc'
            $installerPath | Should Be $paths.Installer
            (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant() | Should Be $script:RustupFixtureHash
        }
        finally {
            Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Variable RustupFixtureHash, RustupFixturePayload -Scope Script -ErrorAction SilentlyContinue
        }
    }

    It 'rejects a downloaded installer whose SHA-256 differs from official metadata' {
        $testRoot = Join-Path $env:TEMP ('lfaa-rustup-mismatch-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
        $payloadPath = Join-Path $testRoot 'untrusted-rustup-fixture.bin'
        Set-Content -LiteralPath $payloadPath -Value 'untrusted installer fixture' -Encoding ASCII -NoNewline
        $script:RustupFixturePayload = $payloadPath
        $paths = Get-LfaaRustToolchainCachePaths -DataDirectory $testRoot
        New-Item -ItemType Directory -Path $paths.Root -Force | Out-Null

        Mock Invoke-LfaaBoundedHttpsDownload {
            param([uri]$Uri, [string]$Destination, [long]$MaximumBytes)
            if ($Uri.AbsoluteUri -like '*.sha256') {
                Set-Content -LiteralPath $Destination -Value ('0' * 64) -Encoding ASCII -NoNewline
            }
            else {
                Copy-Item -LiteralPath $script:RustupFixturePayload -Destination $Destination
            }
        }

        try {
            $rejected = $false
            try { Get-LfaaOfficialRustupInstaller -CachePaths $paths -HostTriple 'x86_64-pc-windows-msvc' | Out-Null }
            catch { $rejected = $_.Exception.Message -match '摘要不匹配' }
            $rejected | Should Be $true
            (Test-Path -LiteralPath $paths.Installer) | Should Be $false
        }
        finally {
            Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Variable RustupFixturePayload -Scope Script -ErrorAction SilentlyContinue
        }
    }

    It 'wires toolchain preparation before development cleanup and desktop builds' {
        $startDev = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\start-dev.ps1') -Raw -Encoding UTF8
        $menu = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\install-dependencies.ps1') -Raw -Encoding UTF8
        $startDev | Should Match 'Initialize-LfaaDataDirectory\s+Initialize-LfaaWindowsRustToolchain[\s\S]*?Stop-PreviousDevelopmentServices'
        $menu | Should Match "'3'\s*\{\s*Initialize-LfaaWindowsRustToolchain[\s\S]*?build:win"
    }

    It 'parses all changed PowerShell entry points' {
        foreach ($path in @(
            $scriptPath,
            (Join-Path $PSScriptRoot '..\start-dev.ps1'),
            (Join-Path $PSScriptRoot '..\install-dependencies.ps1')
        )) {
            $tokens = $null
            $parseErrors = $null
            [void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$parseErrors)
            $parseErrors.Count | Should Be 0
        }
    }
}
