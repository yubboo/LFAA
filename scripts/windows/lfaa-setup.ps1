# Copyright (c) 2026 二鱼.
# Part of the LFAA project.
#
# 文件：lfaa-setup.ps1
# 作用：提供 LFAA 项目依赖、项目级资源和开发质量检查菜单。

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.."))

function Write-Label {
    param([string]$Left,[string]$Right,[string]$Text,[ConsoleColor]$Color=[ConsoleColor]::Gray)
    Write-Host ("{0}{1} " -f $Left,$Right) -ForegroundColor $Color -NoNewline
    Write-Host $Text
}

function Wait-LfaaClose {
    param(
        [bool]$Success,
        [string]$SuccessMessage = ""
    )

    Write-Host ""

    if ($Success) {
        if ([string]::IsNullOrWhiteSpace($SuccessMessage)) {
            $SuccessMessage = "全部操作已完成，现在可以安全关闭终端窗口。"
        }

        Write-Label "【提示】" "【可关闭】" $SuccessMessage Green
    }
    else {
        Write-Label "【提示】" "【可关闭】" "操作未完成；处理上方问题后可重新运行。" Yellow
    }

    Write-Label "【提示】" "【操作】" "按任意键关闭窗口，或直接点击右上角 X。" DarkGray
    try { [void][System.Console]::ReadKey($true) } catch {}
}

function Stop-Lfaa {
    param([string]$Message)
    Write-Host ""
    Write-Label "【错误】" "【失败】" $Message Red
    Wait-LfaaClose $false
    exit 1
}

function Test-CommandAvailable {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandVersion {
    param([string]$Name)
    if (-not (Test-CommandAvailable $Name)) { return "未安装" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $o = @(& $Name --version 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $o.Count -eq 0) { return "已发现，但无法读取版本" }
        return ($o -join " ").Trim()
    } finally {
        $ErrorActionPreference = $old
    }
}

function Get-RequiredToolchainInfo {
    $packageFile = Join-Path $ProjectRoot "package.json"
    $data = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json

    $pnpmVersion = ""
    if ($data.packageManager -and ([string]$data.packageManager -match "^pnpm@(.+)$")) {
        $pnpmVersion = $Matches[1]
    }

    return [PSCustomObject]@{
        NodeMajor = 24
        PnpmVersion = $pnpmVersion
    }
}

function Get-CommandSource {
    param([string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) { return "未安装" }
    if ($command.Source) { return [string]$command.Source }
    return [string]$command.Path
}

function Get-NodeVersionValue {
    if (-not (Test-CommandAvailable "node")) { return "" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& node -p "process.versions.node" 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) { return "" }
        return ($output -join "").Trim()
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Get-DirectPnpmVersion {
    if (-not (Test-CommandAvailable "pnpm")) { return "" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& pnpm --version 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) { return "" }
        return ($output -join "").Trim()
    }
    finally {
        $ErrorActionPreference = $old
    }
}

function Get-PnpmRunner {
    $required = Get-RequiredToolchainInfo
    $directVersion = Get-DirectPnpmVersion

    if (-not [string]::IsNullOrWhiteSpace($directVersion)) {
        if ([string]::IsNullOrWhiteSpace($required.PnpmVersion) -or $directVersion -eq $required.PnpmVersion) {
            return [PSCustomObject]@{
                FilePath = "pnpm"
                Prefix = @()
                Version = $directVersion
                Source = (Get-CommandSource "pnpm")
            }
        }
    }

    if (Test-CommandAvailable "corepack") {
        $old = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $output = @(& corepack pnpm --version 2>&1 | ForEach-Object { [string]$_ })
            $code = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $old
        }

        if ($code -eq 0 -and $output.Count -gt 0) {
            return [PSCustomObject]@{
                FilePath = "corepack"
                Prefix = @("pnpm")
                Version = (($output -join "").Trim())
                Source = (Get-CommandSource "corepack")
            }
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($directVersion)) {
        throw ("检测到 pnpm {0}，但项目要求 pnpm {1}，并且无法通过 corepack 启动项目版本。" -f $directVersion,$required.PnpmVersion)
    }

    throw "未检测到可用的 pnpm 或 corepack。"
}

function Assert-NodeToolchain {
    $required = Get-RequiredToolchainInfo
    $nodeVersion = Get-NodeVersionValue

    if ([string]::IsNullOrWhiteSpace($nodeVersion)) {
        throw "未检测到可用的 Node.js。"
    }

    $majorText = ($nodeVersion -split "\.")[0]
    $major = 0
    if (-not [int]::TryParse($majorText, [ref]$major)) {
        throw ("无法解析 Node.js 版本：{0}" -f $nodeVersion)
    }

    if ($major -ne $required.NodeMajor) {
        throw ("当前 Node.js 为 {0}，项目要求 Node.js 24.x。" -f $nodeVersion)
    }

    $runner = Get-PnpmRunner

    if (-not [string]::IsNullOrWhiteSpace($required.PnpmVersion) -and
        $runner.Version -ne $required.PnpmVersion) {
        throw ("当前可用 pnpm 为 {0}，项目要求 {1}。" -f $runner.Version,$required.PnpmVersion)
    }

    return [PSCustomObject]@{
        NodeVersion = $nodeVersion
        NodeSource = (Get-CommandSource "node")
        PnpmVersion = $runner.Version
        PnpmSource = $runner.Source
    }
}

function Get-WorkspacePackageFiles {
    $files = New-Object System.Collections.Generic.List[string]
    $seen = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

    $rootPackage = Join-Path $ProjectRoot "package.json"
    if (Test-Path -LiteralPath $rootPackage) {
        $full = [System.IO.Path]::GetFullPath($rootPackage)
        if ($seen.Add($full)) { $files.Add($full) }
    }

    $workspaceFile = Join-Path $ProjectRoot "pnpm-workspace.yaml"
    if (-not (Test-Path -LiteralPath $workspaceFile)) {
        return $files
    }

    foreach ($line in Get-Content -LiteralPath $workspaceFile) {
        $match = [regex]::Match($line, '^\s*-\s*["'']?([^"'']+)["'']?\s*$')
        if (-not $match.Success) { continue }

        $pattern = $match.Groups[1].Value.Trim().TrimEnd("/")
        if ([string]::IsNullOrWhiteSpace($pattern)) { continue }

        $packagePattern = Join-Path $ProjectRoot ($pattern + "/package.json")
        Get-ChildItem -Path $packagePattern -File -ErrorAction SilentlyContinue | ForEach-Object {
            $full = [System.IO.Path]::GetFullPath($_.FullName)
            if ($seen.Add($full)) { $files.Add($full) }
        }
    }

    return $files
}

function Get-NodeDependencySummary {
    $packageFiles = Get-WorkspacePackageFiles
    $external = New-Object System.Collections.Generic.HashSet[string]
    $declarations = 0

    foreach ($file in $packageFiles) {
        try {
            $data = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json

            foreach ($section in @("dependencies","devDependencies","optionalDependencies")) {
                $block = $data.$section
                if ($null -eq $block) { continue }

                foreach ($prop in $block.PSObject.Properties) {
                    $declarations += 1
                    $version = [string]$prop.Value

                    if (-not $version.StartsWith("workspace:")) {
                        [void]$external.Add([string]$prop.Name)
                    }
                }
            }
        }
        catch {
            throw ("无法读取 package.json：{0}" -f $file)
        }
    }

    return [PSCustomObject]@{
        WorkspaceProjects = $packageFiles.Count
        DependencyDeclarations = $declarations
        ExternalDependencies = $external.Count
    }
}

function Invoke-ProjectCommand {
    param([string]$FilePath,[string[]]$Arguments,[string]$Description)
    Write-Host ""
    Write-Label "【执行】" "【命令】" $Description Cyan
    Push-Location $ProjectRoot
    try {
        & $FilePath @Arguments
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($code -ne 0) { throw ("{0}失败，退出码：{1}" -f $Description,$code) }
}

function Invoke-Pnpm {
    param([string[]]$Arguments,[string]$Description)
    $runner = Get-PnpmRunner
    Invoke-ProjectCommand $runner.FilePath (@($runner.Prefix)+$Arguments) $Description
}

function Confirm-WriteOperation {
    param([string]$Description)
    Write-Host ""
    Write-Label "【写操作】" "【说明】" $Description Yellow
    return (Read-Host "【确认】【继续】输入 Y 确认，其他键取消") -match "^(?i:y|yes)$"
}

function Show-Environment {
    Write-Host ""
    Write-Label "【项目】" "【根目录】" $ProjectRoot Cyan

    $nodeVersion = Get-NodeVersionValue
    if ([string]::IsNullOrWhiteSpace($nodeVersion)) {
        Write-Label "【环境】" "【Node】" "未安装" Yellow
    }
    else {
        Write-Label "【环境】" "【Node】" ("{0} | {1}" -f $nodeVersion,(Get-CommandSource "node")) Gray
    }

    try {
        $runner = Get-PnpmRunner
        Write-Label "【环境】" "【pnpm】" ("{0} | {1}" -f $runner.Version,$runner.Source) Gray
    }
    catch {
        Write-Label "【环境】" "【pnpm】" ([string]$_.Exception.Message) Yellow
    }

    Write-Label "【环境】" "【corepack】" (Get-CommandVersion "corepack") Gray
    Write-Label "【环境】" "【cargo】" (Get-CommandVersion "cargo") Gray
    Write-Label "【环境】" "【rustc】" (Get-CommandVersion "rustc") Gray
    Write-Label "【环境】" "【winget】" (Get-CommandVersion "winget") Gray

    $summary = Get-NodeDependencySummary
    Write-Label "【项目】" "【workspace】" ("{0} 个 Node workspace 项目" -f $summary.WorkspaceProjects) Cyan
    Write-Label "【项目】" "【Node 依赖】" ("声明 {0} 项；其中外部依赖 {1} 个" -f $summary.DependencyDeclarations,$summary.ExternalDependencies) Cyan

    if ($summary.ExternalDependencies -eq 0) {
        Write-Label "【说明】" "【node_modules】" "当前项目尚未声明第三方 Node 包；目录很小是正常现象。" DarkCyan
    }

    Write-Label "【规则】" "【包管理器】" "Node.js workspace 只允许 pnpm。" Green
}

function Install-NodeDependencies {
    $toolchain = Assert-NodeToolchain
    $summary = Get-NodeDependencySummary

    Write-Label "【检测】" "【Node】" ("{0} | {1}" -f $toolchain.NodeVersion,$toolchain.NodeSource) Green
    Write-Label "【检测】" "【pnpm】" ("{0} | {1}" -f $toolchain.PnpmVersion,$toolchain.PnpmSource) Green
    Write-Label "【检测】" "【workspace】" ("{0} 个项目 | 外部 Node 依赖 {1} 个" -f $summary.WorkspaceProjects,$summary.ExternalDependencies) Green

    if ($summary.ExternalDependencies -eq 0) {
        Write-Label "【说明】" "【Node 依赖】" "当前 package.json 尚未声明第三方 Node 包，因此不会出现大型 node_modules。" DarkCyan
    }

    $args = @("install")

    Invoke-Pnpm $args "校验、安装并同步 pnpm workspace 项目依赖"

    Write-Label "【校验】" "【Node 依赖】" "pnpm install 已完成；缺失依赖会安装，已存在依赖会复用，依赖声明变化时同步 lockfile。" Green
}

function Get-CargoCommandPath {
    $command = Get-Command "cargo" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidate = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Get-RustupCommandPath {
    $command = Get-Command "rustup" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidate = Join-Path $env:USERPROFILE ".cargo\bin\rustup.exe"
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Add-CargoBinToCurrentPath {
    if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        return
    }

    $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"

    if ((Test-Path -LiteralPath $cargoBin) -and
        (($env:PATH -split ";") -notcontains $cargoBin)) {
        $env:PATH = $cargoBin + ";" + $env:PATH
    }
}


function Get-WindowsRustupTarget {
    $arch = [string]$env:PROCESSOR_ARCHITEW6432
    if ([string]::IsNullOrWhiteSpace($arch)) {
        $arch = [string]$env:PROCESSOR_ARCHITECTURE
    }

    switch -Regex ($arch.ToUpperInvariant()) {
        "ARM64" { return "aarch64-pc-windows-msvc" }
        "AMD64|X86_64" { return "x86_64-pc-windows-msvc" }
        "X86" { return "i686-pc-windows-msvc" }
        default { throw ("暂不支持自动识别的 Windows CPU 架构：{0}" -f $arch) }
    }
}

function Invoke-OfficialRustupInstaller {
    $target = Get-WindowsRustupTarget
    $baseUrl = "https://static.rust-lang.org/rustup/dist/{0}/rustup-init.exe" -f $target
    $hashUrl = $baseUrl + ".sha256"

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "lfaa-rustup"
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

    $installer = Join-Path $tempRoot "rustup-init.exe"
    $hashFile = Join-Path $tempRoot "rustup-init.exe.sha256"

    Write-Label "【回退安装】" "【Rustup】" "winget 不可用，将从 Rust 官方 static.rust-lang.org 下载 rustup-init。" Cyan
    Write-Label "【校验】" "【SHA-256】" "执行前会下载 Rust 官方 SHA-256 并进行一致性校验。" DarkCyan

    try {
        Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -OutFile $installer
        Invoke-WebRequest -UseBasicParsing -Uri $hashUrl -OutFile $hashFile

        $expectedText = (Get-Content -LiteralPath $hashFile -Raw).Trim()
        $match = [regex]::Match($expectedText, "(?i)\b[0-9a-f]{64}\b")
        if (-not $match.Success) {
            throw "Rust 官方 SHA-256 文件格式无法识别。"
        }

        $expected = $match.Value.ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()

        if ($actual -ne $expected) {
            throw ("Rustup SHA-256 校验失败。expected={0} actual={1}" -f $expected,$actual)
        }

        Write-Label "【校验】" "【通过】" "rustup-init.exe SHA-256 与 Rust 官方值一致。" Green

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $installer -y --profile default --default-toolchain none
            $installCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }

        if ($installCode -ne 0) {
            Write-Label "【提示】" "【Rustup】" ("官方 rustup-init 退出码：{0}" -f $installCode) Yellow
            return $false
        }

        Add-CargoBinToCurrentPath
        $rustupPath = Get-RustupCommandPath

        if ([string]::IsNullOrWhiteSpace($rustupPath)) {
            Write-Label "【提示】" "【Rustup】" "安装器完成，但当前终端仍未找到 rustup。" Yellow
            return $false
        }

        Write-Label "【Rust】" "【stable】" "显式安装 stable toolchain..." Cyan

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $rustupPath toolchain install stable
            $toolchainCode = $LASTEXITCODE

            if ($toolchainCode -eq 0) {
                & $rustupPath default stable
                $defaultCode = $LASTEXITCODE
            }
            else {
                $defaultCode = 1
            }
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }

        if ($toolchainCode -ne 0 -or $defaultCode -ne 0) {
            Write-Label "【提示】" "【Rust】" "stable toolchain 安装或设置未完成。" Yellow
            return $false
        }

        Add-CargoBinToCurrentPath
        return (-not [string]::IsNullOrWhiteSpace((Get-CargoCommandPath)))
    }
    catch {
        Write-Label "【提示】" "【Rust 官方安装】" ([string]$_.Exception.Message) Yellow
        return $false
    }
    finally {
        Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $hashFile -Force -ErrorAction SilentlyContinue
    }
}

function Install-RustToolchainIfMissing {
    $cargoPath = Get-CargoCommandPath
    if (-not [string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【环境】" "【Rust/Cargo】" ("已安装 | {0}" -f $cargoPath) Green
        Write-Label "【环境】" "【rustc】" (Get-CommandVersion "rustc") Green
        return $true
    }

    Write-Host ""
    Write-Label "【缺失】" "【Rust/Cargo】" "当前没有 Cargo；一键准备将尝试补齐 Rust 工具链。" Yellow

    $wingetSucceeded = $false

    if (Test-CommandAvailable "winget") {
        Write-Label "【准备安装】" "【Rustup】" "优先通过 winget 安装 Rustlang.Rustup。" Cyan

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        try {
            & winget install `
                --id Rustlang.Rustup `
                -e `
                --source winget `
                --accept-package-agreements `
                --accept-source-agreements

            $wingetCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }

        if ($wingetCode -eq 0) {
            $wingetSucceeded = $true
        }
        else {
            Write-Label "【回退】" "【winget】" ("winget 安装未完成，退出码 {0}；将尝试 Rust 官方安装器。" -f $wingetCode) Yellow
        }
    }
    else {
        Write-Label "【检测】" "【winget】" "未安装；将直接尝试 Rust 官方安装器。" Yellow
    }

    Add-CargoBinToCurrentPath

    if (-not $wingetSucceeded -and [string]::IsNullOrWhiteSpace((Get-CargoCommandPath))) {
        [void](Invoke-OfficialRustupInstaller)
    }

    Add-CargoBinToCurrentPath

    $rustupPath = Get-RustupCommandPath
    $cargoPath = Get-CargoCommandPath

    if (-not [string]::IsNullOrWhiteSpace($rustupPath) -and
        [string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【Rust】" "【stable】" "检测到 rustup，但 Cargo 尚不可用；正在显式安装 stable toolchain..." Cyan

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $rustupPath toolchain install stable
            $toolchainCode = $LASTEXITCODE
            if ($toolchainCode -eq 0) {
                & $rustupPath default stable
                $defaultCode = $LASTEXITCODE
            }
            else {
                $defaultCode = 1
            }
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }

        Add-CargoBinToCurrentPath
        $cargoPath = Get-CargoCommandPath
    }

    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【未完成】" "【Rust/Cargo】" "winget 与 Rust 官方安装回退均未得到可用 Cargo。" Yellow
        return $false
    }

    Write-Label "【完成】" "【Cargo】" ("{0} | {1}" -f (Get-CommandVersion "cargo"),$cargoPath) Green
    Write-Label "【完成】" "【rustc】" (Get-CommandVersion "rustc") Green
    return $true
}

function Test-RustDependencyDeclarations {
    $cargoFiles = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "crates") `
        -Filter "Cargo.toml" -File -Recurse -ErrorAction SilentlyContinue

    foreach ($file in $cargoFiles) {
        $text = Get-Content -LiteralPath $file.FullName -Raw

        if ($text -match '(?m)^\[(?:dev-|build-)?dependencies(?:\.[^\]]+)?\]\s*$' -or
            $text -match '(?m)^\[target\.[^\]]+\.dependencies\]\s*$') {
            return $true
        }
    }

    return $false
}

function Install-RustDependencies {
    $cargoPath = Get-CargoCommandPath
    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        throw "未检测到 Cargo。请选择菜单 1 进行一键准备，或先安装 Rust 工具链。"
    }

    $lockFile = Join-Path $ProjectRoot "Cargo.lock"

    if (-not (Test-Path -LiteralPath $lockFile)) {
        if (Test-RustDependencyDeclarations) {
            throw "检测到 Rust 外部依赖，但仓库缺少 Cargo.lock。为避免本机生成未受控锁文件，已停止；请先由开发版本提交 Cargo.lock。"
        }

        Write-Label "【Rust】" "【依赖】" "当前 Cargo workspace 尚未声明外部 crate，无需下载 Rust 依赖。" Green
        return
    }

    Invoke-ProjectCommand $cargoPath @("fetch","--locked") "下载 Rust/Cargo 项目依赖"
}

function Initialize-ProjectResources {
    $root = Join-Path $ProjectRoot ".lfaa"
    foreach ($d in @("skills","experts","plugins","extensions","mcp","cache","state","tmp","logs")) {
        $p = Join-Path $root $d
        if (-not (Test-Path $p)) {
            New-Item -ItemType Directory -Path $p -Force | Out-Null
            Write-Label "【创建】" "【项目】" (".lfaa/{0}" -f $d) Green
        }
    }
}

function Invoke-GovernanceChecks {
    Invoke-ProjectCommand "node" @("scripts/governance-check.mjs") "运行项目治理检查"
    Invoke-ProjectCommand "node" @("scripts/import-path-check.mjs") "运行导入边界检查"
}

function Invoke-PnpmScript {
    param([string]$Name)
    Invoke-Pnpm @("run",$Name) ("运行 {0}" -f $Name)
}


function Get-WorkspacePackageData {
    param([string]$RelativePackageFile)

    $file = Join-Path $ProjectRoot $RelativePackageFile
    if (-not (Test-Path -LiteralPath $file)) {
        throw ("缺少 workspace package.json：{0}" -f $RelativePackageFile)
    }

    try {
        return Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    }
    catch {
        throw ("无法读取 workspace package.json：{0}" -f $RelativePackageFile)
    }
}

function Assert-WorkspaceScript {
    param(
        [string]$RelativePackageFile,
        [string]$ScriptName,
        [string]$DisplayName
    )

    $data = Get-WorkspacePackageData $RelativePackageFile
    $script = $data.scripts.$ScriptName

    if ([string]::IsNullOrWhiteSpace([string]$script)) {
        throw ("{0} 尚未配置 {1} 脚本；当前功能未实现，不会伪装成功。" -f $DisplayName,$ScriptName)
    }
}

function Get-DesktopReleaseScript {
    $data = Get-WorkspacePackageData "apps\desktop\package.json"

    foreach ($candidate in @("make","package","release")) {
        $value = $data.scripts.$candidate
        if (-not [string]::IsNullOrWhiteSpace([string]$value)) {
            return $candidate
        }
    }

    return $null
}

function Invoke-PnpmForeground {
    param(
        [string[]]$Arguments,
        [string]$Description
    )

    $runner = Get-PnpmRunner
    $code = 0

    Write-Host ""
    Write-Label "【启动】" "【命令】" $Description Cyan

    Push-Location $ProjectRoot
    try {
        try {
            & $runner.FilePath @($runner.Prefix) @Arguments
            $code = $LASTEXITCODE
        }
        catch [System.Management.Automation.PipelineStoppedException] {
            $code = 130
        }
    }
    finally {
        Pop-Location
    }

    if ($code -notin @(0,130,-1073741510)) {
        throw ("{0}失败，退出码：{1}" -f $Description,$code)
    }

    Write-Label "【停止】" "【完成】" ("{0} 已停止。" -f $Description) Green
}

function Start-WebDevelopment {
    Assert-WorkspaceScript "apps\web\package.json" "dev" "Web 端"
    Write-Host ""
    Write-Label "【启动】" "【Web】" "Vite：http://127.0.0.1:5173" Green
    Write-Label "【热插拔】" "【监听】" ".lfaa/skills、experts、plugins、extensions、mcp" Cyan
    Write-Label "【提示】" "【停止】" "开发服务器运行期间保持窗口开启；按 Ctrl+C 停止。" DarkGray
    Invoke-PnpmForeground @("--filter","@lfaa/web","dev") "Web / Vite 开发服务器"
}

function Start-DesktopDevelopment {
    Assert-WorkspaceScript "apps\desktop\package.json" "dev" "桌面端"
    Write-Host ""
    Write-Label "【启动】" "【Desktop】" "启动 Electron Desktop 开发模式。" Green
    Write-Label "【提示】" "【停止】" "桌面开发进程运行期间保持窗口开启；按 Ctrl+C 停止。" DarkGray
    Invoke-PnpmForeground @("--filter","@lfaa/desktop","dev") "Electron Desktop 开发模式"
}

function Build-Web {
    Assert-WorkspaceScript "apps\web\package.json" "build" "Web 端"
    Invoke-Pnpm @("--filter","@lfaa/web","build") "构建 Web production"
    Write-Label "【产物】" "【Web】" "apps/web/dist" Green
}

function Build-Desktop {
    Assert-WorkspaceScript "apps\desktop\package.json" "build" "桌面端"
    Invoke-Pnpm @("--filter","@lfaa/desktop","build") "构建 Desktop production"
}

function Build-AndReleaseAll {
    Assert-WorkspaceScript "apps\web\package.json" "build" "Web 端"
    Assert-WorkspaceScript "apps\desktop\package.json" "build" "桌面端"

    $desktopReleaseScript = Get-DesktopReleaseScript
    if ([string]::IsNullOrWhiteSpace($desktopReleaseScript)) {
        throw "桌面端尚未配置 make/package/release 脚本；正式构建发布暂不可执行。"
    }

    Write-Host ""
    Write-Label "【预检】" "【构建发布】" "Web 与 Desktop 发布脚本齐备，开始生成本地发布产物。" Cyan
    Write-Label "【说明】" "【远程】" "本操作只生成本地产物，不自动上传 GitHub 或其他远程服务。" DarkCyan

    Build-Web
    Build-Desktop
    Invoke-Pnpm @("--filter","@lfaa/desktop",$desktopReleaseScript) ("生成 Desktop 发布产物：{0}" -f $desktopReleaseScript)

    Write-Host ""
    Write-Label "【完成】" "【Web】" "Web production 已生成。" Green
    Write-Label "【完成】" "【Desktop】" "Desktop 本地发布产物已生成。" Green
}


function Test-NodeDependencyToolchain {
    try {
        [void](Assert-NodeToolchain)
        return $true
    }
    catch {
        return $false
    }
}

function Test-RustDependencyToolchain {
    return -not [string]::IsNullOrWhiteSpace((Get-CargoCommandPath))
}

function Show-SetupMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 开发、运行、构建与质量检查菜单" -ForegroundColor Cyan
    Write-Host " 作者：二鱼" -ForegroundColor DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【一键依赖】" "检测工具链、补齐 Rust/Cargo、安装全部项目依赖并初始化 .lfaa。" Green
    Write-Label "【2】" "【启动 Web】" "启动 Vite Web 开发服务器，并启用 .lfaa 本地热插拔监听。" Green
    Write-Label "【3】" "【启动桌面】" "启动 Electron Desktop 开发模式；未配置时明确提示。" Green
    Write-Label "【4】" "【构建 Web】" "执行 Web production build。" Cyan
    Write-Label "【5】" "【构建桌面】" "执行 Desktop production build；未配置时明确提示。" Cyan
    Write-Label "【6】" "【构建发布】" "构建 Web + Desktop 并生成本地发布产物；不自动上传远程。" Magenta
    Write-Label "【7】" "【环境检查】" "查看项目根、Node/pnpm、Rust/Cargo 和依赖状态。" Cyan
    Write-Label "【8】" "【项目资源】" "初始化当前项目 .lfaa 缺失目录。" Magenta
    Write-Label "【9】" "【治理检查】" "运行治理、导入边界、开发日志和 docs 结构检查。" Yellow
    Write-Label "【10】" "【完整检查】" "运行项目严格质量检查；未配置项必须失败，不假绿。" Yellow
    Write-Label "【0】" "【退出】" "不执行任何操作。" DarkGray
}
if (-not (Test-Path (Join-Path $ProjectRoot "lfaa.release.json"))) {
    Stop-Lfaa "脚本所在目录不是有效的 LFAA 项目根。"
}

Show-SetupMenu
$choice = (Read-Host "【请选择】【0-10】").Trim()

try {
    switch ($choice) {
        "1" {
            if (-not (Test-NodeDependencyToolchain)) {
                Show-Environment
                throw "未检测到可用的 Node + pnpm/corepack 工具链。Node.js 是 LFAA 当前开发的基础前置条件。"
            }

            Write-Host ""
            $nodeToolchain = Assert-NodeToolchain
            $nodeSummary = Get-NodeDependencySummary

            Write-Label "【预检】" "【Node】" ("{0} | {1}" -f $nodeToolchain.NodeVersion,$nodeToolchain.NodeSource) Green
            Write-Label "【预检】" "【pnpm】" ("{0} | {1}" -f $nodeToolchain.PnpmVersion,$nodeToolchain.PnpmSource) Green
            Write-Label "【预检】" "【workspace】" ("{0} 个项目 | 外部 Node 依赖 {1} 个" -f $nodeSummary.WorkspaceProjects,$nodeSummary.ExternalDependencies) Green

            if ($nodeSummary.ExternalDependencies -eq 0) {
                Write-Label "【说明】" "【node_modules】" "当前没有第三方 Node 包需要安装；目录很小是正常的。" DarkCyan
            }

            $cargoReadyBefore = Test-RustDependencyToolchain
            if ($cargoReadyBefore) {
                Write-Label "【预检】" "【Rust/Cargo】" ("可用 | {0}" -f (Get-CargoCommandPath)) Green
            }
            else {
                if (Test-CommandAvailable "winget") {
                    Write-Label "【预检】" "【Rust/Cargo】" "缺失；确认后先用 winget，失败再用 Rust 官方安装器。" Yellow
                }
                else {
                    Write-Label "【预检】" "【Rust/Cargo】" "缺失；winget 也缺失，确认后改用 Rust 官方安装器。" Yellow
                }
            }

            if (-not (Confirm-WriteOperation "将真实校验 Node/pnpm 依赖；如 Cargo 缺失，会尝试 winget 或 Rust 官方安装器。")) {
                Wait-LfaaClose $true "用户已取消，一键准备未继续执行；现在可以安全关闭终端窗口。"
                exit 0
            }

            Install-NodeDependencies

            $cargoReady = Install-RustToolchainIfMissing
            if ($cargoReady) {
                Install-RustDependencies
            }
            else {
                Write-Label "【待补齐】" "【Rust/Cargo】" "Rust 环境尚未完成；当前 Node/pnpm 环境已经准备好。" Yellow
            }

            Initialize-ProjectResources

            Write-Host ""
            Write-Label "【完成】" "【Node/pnpm】" "项目 Node 依赖已确认。" Green

            if ($cargoReady) {
                Write-Label "【完成】" "【Rust/Cargo】" "Rust 工具链和当前已声明 Rust 依赖已确认。" Green
                Wait-LfaaClose $true "项目当前已声明的开发依赖已经准备完成；现在可以安全关闭终端窗口。"
                exit 0
            }

            Write-Host ""
            Write-Label "【部分完成】" "【Node/pnpm】" "已完成真实校验。" Green
            Write-Label "【未完成】" "【Rust/Cargo】" "自动安装没有得到可用 Cargo；请查看上方具体失败原因。" Yellow
            Wait-LfaaClose $false
            exit 2
        }
        "2" {
            Start-WebDevelopment
            exit 0
        }
        "3" {
            Start-DesktopDevelopment
            exit 0
        }
        "4" {
            Build-Web
        }
        "5" {
            Build-Desktop
        }
        "6" {
            Build-AndReleaseAll
        }
        "7" {
            Show-Environment
        }
        "8" {
            if (-not (Confirm-WriteOperation "将在当前项目创建缺失的 .lfaa 目录。")) { Wait-LfaaClose $true; exit 0 }
            Initialize-ProjectResources
        }
        "9" {
            Invoke-PnpmScript "governance:check"
        }
        "10" {
            Invoke-PnpmScript "governance:check"
            Invoke-PnpmScript "typecheck:web"
            Invoke-PnpmScript "build:web"

            Invoke-PnpmScript "typecheck"
            Invoke-PnpmScript "test"
            Invoke-PnpmScript "build"

            $cargoPath = Get-CargoCommandPath
            if ([string]::IsNullOrWhiteSpace($cargoPath)) {
                throw "完整检查需要 Rust/Cargo；当前未检测到 Cargo。"
            }

            Invoke-ProjectCommand $cargoPath @("check","--workspace") "运行 Rust cargo check"
            Invoke-ProjectCommand $cargoPath @("test","--workspace") "运行 Rust cargo test"
        }
        "0" { Write-Label "【退出】" "【完成】" "未执行任何操作。" Green; Wait-LfaaClose $true; exit 0 }
        default { throw "无效选项，请输入 0 到 10。" }
    }
} catch {
    Stop-Lfaa ([string]$_.Exception.Message)
}

Write-Host ""
Write-Label "【完成】" "【成功】" "所选操作已完成。" Green
Wait-LfaaClose $true
exit 0
