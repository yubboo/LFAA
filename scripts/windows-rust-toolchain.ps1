<#
功能：为 Windows Daemon Host 构建准备 Rust stable/MSVC 工具链。
作用：优先复用完整的现有工具链；缺失时将官方 rustup 与 toolchain 安装到当前 LFAA_DATA_DIR/cache/rust，环境变量只作用于当前进程树。
关联文件：scripts/start-dev.ps1、scripts/install-dependencies.ps1、scripts/resolve-data-directory.mjs、apps/daemon/package.json、native/system/Cargo.toml。
#>

function Get-LfaaRustupHostTriple {
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw 'Windows Sandbox Host 需要 64 位 Windows。'
    }

    $architecture = [string]$env:PROCESSOR_ARCHITEW6432
    if ([string]::IsNullOrWhiteSpace($architecture)) { $architecture = [string]$env:PROCESSOR_ARCHITECTURE }
    switch ($architecture.ToUpperInvariant()) {
        'ARM64' { return 'aarch64-pc-windows-msvc' }
        'AMD64' { return 'x86_64-pc-windows-msvc' }
        'X86' { return 'x86_64-pc-windows-msvc' }
        default { throw "不支持当前 Windows 主机架构：$architecture。" }
    }
}

function Get-LfaaRustupInstallerUri {
    param([Parameter(Mandatory = $true)][string]$HostTriple)

    if ($HostTriple -notin @('x86_64-pc-windows-msvc', 'aarch64-pc-windows-msvc')) {
        throw "不支持 Rustup 安装器架构：$HostTriple。"
    }
    return "https://static.rust-lang.org/rustup/dist/$HostTriple/rustup-init.exe"
}

function Get-LfaaRustToolchainCachePaths {
    param([Parameter(Mandatory = $true)][string]$DataDirectory)

    $cacheRoot = [System.IO.Path]::GetFullPath((Join-Path $DataDirectory 'cache/rust'))
    $cargoHome = Join-Path $cacheRoot 'cargo'
    $rustupHome = Join-Path $cacheRoot 'rustup'
    return [PSCustomObject]@{
        Root = $cacheRoot
        CargoHome = $cargoHome
        RustupHome = $rustupHome
        Bin = Join-Path $cargoHome 'bin'
        Installer = Join-Path $cacheRoot 'rustup-init.exe'
        Checksum = Join-Path $cacheRoot 'rustup-init.exe.sha256'
    }
}

function Get-LfaaRustupSha256 {
    param([Parameter(Mandatory = $true)][string]$Text)

    $match = [regex]::Match($Text, '(?i)\b[0-9a-f]{64}\b')
    if (-not $match.Success) { throw 'Rustup 官方 SHA-256 文件格式无效。' }
    return $match.Value.ToLowerInvariant()
}

function Test-LfaaRustToolchain {
    param(
        [Parameter(Mandatory = $true)][string]$HostTriple,
        [string]$BinDirectory = ''
    )

    if ($BinDirectory) {
        $rustupPath = Join-Path $BinDirectory 'rustup.exe'
        $cargoPath = Join-Path $BinDirectory 'cargo.exe'
        $rustcPath = Join-Path $BinDirectory 'rustc.exe'
        if (-not (Test-Path -LiteralPath $rustupPath -PathType Leaf) -or
            -not (Test-Path -LiteralPath $cargoPath -PathType Leaf) -or
            -not (Test-Path -LiteralPath $rustcPath -PathType Leaf)) { return $false }
    }
    else {
        $rustupCommand = Get-Command 'rustup' -ErrorAction SilentlyContinue
        $cargoCommand = Get-Command 'cargo' -ErrorAction SilentlyContinue
        $rustcCommand = Get-Command 'rustc' -ErrorAction SilentlyContinue
        if (-not $rustupCommand -or -not $cargoCommand -or -not $rustcCommand) { return $false }
        $rustupPath = $rustupCommand.Source
        $cargoPath = $cargoCommand.Source
        $rustcPath = $rustcCommand.Source
    }

    $rustcInfo = @(& $rustcPath '+stable' '-vV' 2>$null)
    $rustcExitCode = $LASTEXITCODE
    if ($rustcExitCode -ne 0 -or -not ($rustcInfo -match "(?m)^host:\s+$([regex]::Escape($HostTriple))\s*$")) { return $false }

    $cargoVersion = @(& $cargoPath '+stable' '--version' 2>$null)
    $cargoExitCode = $LASTEXITCODE
    if ($cargoExitCode -ne 0 -or $cargoVersion.Count -eq 0) { return $false }

    $installedTargets = @(& $rustupPath 'target' 'list' '--toolchain' 'stable' '--installed' 2>$null)
    $targetExitCode = $LASTEXITCODE
    return $targetExitCode -eq 0 -and $installedTargets -contains 'x86_64-pc-windows-msvc'
}

function Invoke-LfaaBoundedHttpsDownload {
    param(
        [Parameter(Mandatory = $true)][uri]$Uri,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][long]$MaximumBytes
    )

    if ($Uri.Scheme -ne 'https' -or $Uri.Host -ne 'static.rust-lang.org') {
        throw 'Rust 工具链下载只允许 HTTPS Rust 官方分发主机。'
    }

    $currentUri = $Uri
    for ($redirectCount = 0; $redirectCount -le 5; $redirectCount++) {
        $request = [System.Net.HttpWebRequest]::Create($currentUri)
        $request.AllowAutoRedirect = $false
        $request.Timeout = 120000
        $request.ReadWriteTimeout = 120000
        $request.UserAgent = 'LFAA-Windows-Rustup-Bootstrap'
        $response = $null
        $sourceStream = $null
        $destinationStream = $null
        try {
            try { $response = [System.Net.HttpWebResponse]$request.GetResponse() }
            catch [System.Net.WebException] {
                if ($_.Exception.Response -is [System.Net.HttpWebResponse]) {
                    $response = [System.Net.HttpWebResponse]$_.Exception.Response
                }
                else { throw }
            }

            $statusCode = [int]$response.StatusCode
            if ($statusCode -in @(301, 302, 303, 307, 308)) {
                $location = [string]$response.Headers['Location']
                $response.Close()
                $response = $null
                if (-not $location -or $redirectCount -ge 5) { throw 'Rust 官方下载地址返回无效或过多的重定向。' }
                $nextUri = [System.Uri]::new($currentUri, $location)
                if ($nextUri.Scheme -ne 'https' -or -not $nextUri.Host.Equals('static.rust-lang.org', [System.StringComparison]::OrdinalIgnoreCase)) {
                    throw "Rust 官方下载重定向到不受信任的主机：$nextUri"
                }
                $currentUri = $nextUri
                continue
            }
            if ($statusCode -ne 200) { throw "Rust 官方下载返回 HTTP $statusCode。" }
            if ($response.ContentLength -gt $MaximumBytes) {
                throw "Rust 官方下载文件超过限制 $MaximumBytes 字节。"
            }

            $sourceStream = $response.GetResponseStream()
            $destinationStream = [System.IO.File]::Open($Destination, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $buffer = New-Object byte[] 65536
            $totalBytes = [long]0
            while (($bytesRead = $sourceStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $totalBytes += $bytesRead
                if ($totalBytes -gt $MaximumBytes) { throw "Rust 官方下载流超过限制 $MaximumBytes 字节。" }
                $destinationStream.Write($buffer, 0, $bytesRead)
            }
            $destinationStream.Flush()
            return $totalBytes
        }
        finally {
            if ($destinationStream) { $destinationStream.Dispose() }
            if ($sourceStream) { $sourceStream.Dispose() }
            if ($response) { $response.Close() }
        }
    }
    throw 'Rust 官方下载重定向次数超出上限。'
}

function Resolve-LfaaRustToolchainDataDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [string]$DataDirectory = ''
    )

    if (-not [string]::IsNullOrWhiteSpace($DataDirectory)) {
        return [System.IO.Path]::GetFullPath($DataDirectory)
    }

    $nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw '无法准备 Rust 缓存：未检测到 Node.js 数据目录解析器运行环境。' }
    $resolverPath = Join-Path $ProjectRoot 'scripts/resolve-data-directory.mjs'
    $resolvedLines = @(& $nodeCommand.Source $resolverPath $ProjectRoot 2>&1 | ForEach-Object { [string]$_ })
    $resolverExitCode = $LASTEXITCODE
    $resolvedPath = ([string]($resolvedLines | Select-Object -Last 1)).Trim()
    if ($resolverExitCode -ne 0 -or -not $resolvedPath -or -not [System.IO.Path]::IsPathRooted($resolvedPath)) {
        throw "无法通过当前 LFAA 数据目录解析器确定 Rust 缓存位置：$($resolvedLines -join ' ')"
    }
    return [System.IO.Path]::GetFullPath($resolvedPath)
}

function Get-LfaaOfficialRustupInstaller {
    param(
        [Parameter(Mandatory = $true)][PSCustomObject]$CachePaths,
        [Parameter(Mandatory = $true)][string]$HostTriple
    )

    $installerUri = Get-LfaaRustupInstallerUri -HostTriple $HostTriple
    $checksumUri = "$installerUri.sha256"
    $temporaryInstaller = Join-Path $CachePaths.Root ("rustup-init.{0}.download" -f [guid]::NewGuid().ToString('N'))
    $temporaryChecksum = Join-Path $CachePaths.Root ("rustup-init.{0}.sha256.download" -f [guid]::NewGuid().ToString('N'))
    $previousSecurityProtocol = [Net.ServicePointManager]::SecurityProtocol

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $null = Invoke-LfaaBoundedHttpsDownload -Uri $checksumUri -Destination $temporaryChecksum -MaximumBytes 4096
        $expectedHash = Get-LfaaRustupSha256 -Text (Get-Content -LiteralPath $temporaryChecksum -Raw -Encoding ASCII)

        if (Test-Path -LiteralPath $CachePaths.Installer -PathType Leaf) {
            $cachedHash = (Get-FileHash -LiteralPath $CachePaths.Installer -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($cachedHash -eq $expectedHash) {
                Move-Item -LiteralPath $temporaryChecksum -Destination $CachePaths.Checksum -Force
                return $CachePaths.Installer
            }
        }

        $null = Invoke-LfaaBoundedHttpsDownload -Uri $installerUri -Destination $temporaryInstaller -MaximumBytes (32 * 1024 * 1024)
        $downloadedHash = (Get-FileHash -LiteralPath $temporaryInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($downloadedHash -ne $expectedHash) {
            throw "Rustup 安装器摘要不匹配；期望 $expectedHash，实际 $downloadedHash。"
        }

        Move-Item -LiteralPath $temporaryInstaller -Destination $CachePaths.Installer -Force
        Move-Item -LiteralPath $temporaryChecksum -Destination $CachePaths.Checksum -Force
        Write-Host "已从 Rust 官方分发源下载并校验 Rustup：$installerUri" -ForegroundColor DarkGray
        return $CachePaths.Installer
    }
    catch {
        throw "无法从 Rust 官方分发源获取并校验 Rustup（$installerUri）：$($_.Exception.Message)"
    }
    finally {
        [Net.ServicePointManager]::SecurityProtocol = $previousSecurityProtocol
        Remove-Item -LiteralPath $temporaryInstaller -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $temporaryChecksum -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-LfaaRustupBootstrap {
    param(
        [Parameter(Mandatory = $true)][string]$InstallerPath,
        [Parameter(Mandatory = $true)][PSCustomObject]$CachePaths,
        [Parameter(Mandatory = $true)][string]$HostTriple
    )

    $env:CARGO_HOME = $CachePaths.CargoHome
    $env:RUSTUP_HOME = $CachePaths.RustupHome
    $env:RUSTUP_DIST_SERVER = 'https://static.rust-lang.org'
    $env:RUSTUP_UPDATE_ROOT = 'https://static.rust-lang.org/rustup'
    $env:PATH = "$($CachePaths.Bin);$env:PATH"

    & $InstallerPath '-y' '--no-modify-path' '--default-toolchain' 'none' '--default-host' $HostTriple
    if ($LASTEXITCODE -ne 0) { throw "Rustup 安装器退出代码：$LASTEXITCODE。" }

    $rustupPath = Join-Path $CachePaths.Bin 'rustup.exe'
    if (-not (Test-Path -LiteralPath $rustupPath -PathType Leaf)) { throw 'Rustup 安装器结束后未生成 rustup.exe。' }
    & $rustupPath 'toolchain' 'install' 'stable' '--profile' 'minimal' '--target' 'x86_64-pc-windows-msvc'
    if ($LASTEXITCODE -ne 0) { throw "Rust stable MSVC 工具链安装失败，退出代码：$LASTEXITCODE。" }
    & $rustupPath 'target' 'add' '--toolchain' 'stable' 'x86_64-pc-windows-msvc'
    if ($LASTEXITCODE -ne 0) { throw "Rust stable MSVC target 安装失败，退出代码：$LASTEXITCODE。" }
}

function Initialize-LfaaWindowsRustToolchain {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [string]$DataDirectory = ''
    )

    $hostTriple = Get-LfaaRustupHostTriple
    if (Test-LfaaRustToolchain -HostTriple $hostTriple) {
        $env:RUSTUP_TOOLCHAIN = 'stable'
        Write-Host 'Rust stable 与 Windows x64 MSVC target 已就绪，复用现有安装。' -ForegroundColor DarkGray
        return
    }

    $resolvedDataDirectory = Resolve-LfaaRustToolchainDataDirectory -ProjectRoot $ProjectRoot -DataDirectory $DataDirectory
    $cachePaths = Get-LfaaRustToolchainCachePaths -DataDirectory $resolvedDataDirectory
    foreach ($directory in @($cachePaths.Root, $cachePaths.CargoHome, $cachePaths.RustupHome)) {
        if (Test-Path -LiteralPath $directory) {
            $item = Get-Item -LiteralPath $directory -Force
            if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Rust 工具链缓存路径必须是普通目录，不能是文件或重解析点：$directory"
            }
        }
        else {
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
        }
    }

    $mutexHashProvider = [Security.Cryptography.SHA256]::Create()
    try {
        $mutexHash = [BitConverter]::ToString($mutexHashProvider.ComputeHash([Text.Encoding]::UTF8.GetBytes($cachePaths.Root.ToLowerInvariant()))).Replace('-', '')
    }
    finally { $mutexHashProvider.Dispose() }
    $mutex = New-Object System.Threading.Mutex($false, "Local\LFAA-RustToolchain-$($mutexHash.Substring(0, 24))")
    $ownsMutex = $false
    try {
        try { $ownsMutex = $mutex.WaitOne([TimeSpan]::FromHours(2)) }
        catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
        if (-not $ownsMutex) { throw '等待另一个 LFAA Rust 工具链安装超过 2 小时。' }

        $env:CARGO_HOME = $cachePaths.CargoHome
        $env:RUSTUP_HOME = $cachePaths.RustupHome
        $env:RUSTUP_TOOLCHAIN = 'stable'
        $env:RUSTUP_DIST_SERVER = 'https://static.rust-lang.org'
        $env:RUSTUP_UPDATE_ROOT = 'https://static.rust-lang.org/rustup'
        if (-not (($env:PATH -split ';') -contains $cachePaths.Bin)) { $env:PATH = "$($cachePaths.Bin);$env:PATH" }

        if (-not (Test-LfaaRustToolchain -HostTriple $hostTriple -BinDirectory $cachePaths.Bin)) {
            Write-Host "未检测到完整 Rust stable/MSVC 工具链，正在准备 LFAA 缓存：$($cachePaths.Root)" -ForegroundColor Yellow
            $installerPath = Get-LfaaOfficialRustupInstaller -CachePaths $cachePaths -HostTriple $hostTriple
            Invoke-LfaaRustupBootstrap -InstallerPath $installerPath -CachePaths $cachePaths -HostTriple $hostTriple
        }

        if (-not (Test-LfaaRustToolchain -HostTriple $hostTriple -BinDirectory $cachePaths.Bin)) {
            throw 'Rustup 安装后仍未检测到 stable MSVC host 和 x86_64-pc-windows-msvc target。'
        }
        Write-Host "Rust 工具链已就绪并缓存在：$($cachePaths.Root)" -ForegroundColor Green
    }
    finally {
        if ($ownsMutex) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}
