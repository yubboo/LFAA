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

function Wait-LfaaMenu {
    param(
        [string]$Message = "按任意键返回主菜单。"
    )

    Write-Host ""
    Write-Label "【提示】" "【返回菜单】" $Message DarkGray
    try { [void][System.Console]::ReadKey($true) } catch {}
}

function Stop-Lfaa {
    param([string]$Message)
    Write-Host ""
    Write-Label "【错误】" "【失败】" $Message Red
    Write-Label "【提示】" "【退出】" "项目根无效，无法进入主菜单。" Yellow
    try { [void][System.Console]::ReadKey($true) } catch {}
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
    Write-Label "【项目】" "【Rust 版本】" (Get-ProjectRustChannel) Cyan
    Write-Label "【环境】" "【CARGO_HOME】" (Get-CargoHomePath) Gray
    Write-Label "【环境】" "【RUSTUP_HOME】" (Get-RustupHomePath) Gray

    $summary = Get-NodeDependencySummary
    Write-Label "【项目】" "【workspace】" ("{0} 个 Node workspace 项目" -f $summary.WorkspaceProjects) Cyan
    Write-Label "【项目】" "【Node 依赖】" ("声明 {0} 项；其中外部依赖 {1} 个" -f $summary.DependencyDeclarations,$summary.ExternalDependencies) Cyan

    if ($summary.ExternalDependencies -eq 0) {
        Write-Label "【说明】" "【node_modules】" "当前项目尚未声明第三方 Node 包；目录很小是正常现象。" DarkCyan
    }

    Write-Label "【规则】" "【包管理器】" "Node.js workspace 只允许 pnpm。" Green
}

function Test-NodePtyRuntime {
    $webRoot = Join-Path $ProjectRoot "apps\web"
    if (-not (Test-Path -LiteralPath $webRoot)) {
        return $false
    }

    $code = 1
    Push-Location $webRoot
    try {
        & node -e 'const pty = require("node-pty"); if (!pty || typeof pty.spawn !== "function") process.exit(2);'
        $code = $LASTEXITCODE
    }
    catch {
        $code = 1
    }
    finally {
        Pop-Location
    }

    return ($code -eq 0)
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

    $nodePtyPackage = Join-Path $ProjectRoot "apps\web\node_modules\node-pty\package.json"
    if (Test-Path -LiteralPath $nodePtyPackage) {
        Write-Label "【校验】" "【node-pty】" "检测真实终端原生模块是否可加载。" Cyan
        if (-not (Test-NodePtyRuntime)) {
            throw "node-pty 已安装但原生模块无法加载。请查看上方构建日志；这通常表示原生构建未完成，而不是普通 JS 依赖缺失。"
        }
        Write-Label "【通过】" "【node-pty】" "真实终端原生模块可用。" Green
    }
}


function Get-ProjectRustChannel {
    $toolchainFile = Join-Path $ProjectRoot "rust-toolchain.toml"
    if (-not (Test-Path -LiteralPath $toolchainFile)) {
        throw "缺少 rust-toolchain.toml；项目必须显式锁定 Rust 工具链版本。"
    }

    $text = Get-Content -LiteralPath $toolchainFile -Raw
    $match = [regex]::Match($text, '(?m)^\s*channel\s*=\s*"([^"]+)"\s*$')
    if (-not $match.Success) {
        throw "rust-toolchain.toml 缺少有效 channel。"
    }

    return $match.Groups[1].Value.Trim()
}

function Get-CargoHomePath {
    if (-not [string]::IsNullOrWhiteSpace([string]$env:CARGO_HOME)) {
        return [System.IO.Path]::GetFullPath($env:CARGO_HOME)
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
        return (Join-Path $env:USERPROFILE ".cargo")
    }
    return "未确定"
}

function Get-RustupHomePath {
    if (-not [string]::IsNullOrWhiteSpace([string]$env:RUSTUP_HOME)) {
        return [System.IO.Path]::GetFullPath($env:RUSTUP_HOME)
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
        return (Join-Path $env:USERPROFILE ".rustup")
    }
    return "未确定"
}

function Get-CargoBinCandidates {
    $candidates = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace([string]$env:CARGO_HOME)) {
        $candidates.Add((Join-Path $env:CARGO_HOME "bin"))
    }

    if (-not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
        $candidates.Add((Join-Path $env:USERPROFILE ".cargo\bin"))
    }

    return @($candidates | Select-Object -Unique)
}

function Get-CargoCommandPath {
    $command = Get-Command "cargo" -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    foreach ($bin in Get-CargoBinCandidates) {
        $candidate = Join-Path $bin "cargo.exe"
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

    foreach ($bin in Get-CargoBinCandidates) {
        $candidate = Join-Path $bin "rustup.exe"
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    return $null
}

function Add-CargoBinToCurrentPath {
    foreach ($cargoBin in Get-CargoBinCandidates) {
        if ((Test-Path -LiteralPath $cargoBin) -and
            (($env:PATH -split ";") -notcontains $cargoBin)) {
            $env:PATH = $cargoBin + ";" + $env:PATH
        }
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

    Write-Label "【官方安装】" "【Rust/Cargo】" "当前未检测到 Rust，将使用 Rust 官方安装器自动补齐。" Cyan
    Write-Label "【校验】" "【SHA-256】" "执行前会下载 Rust 官方 SHA-256 并进行一致性校验。" DarkCyan
    Write-Label "【说明】" "【官方输出】" "后续 info: 英文为 Rust 官方 rustup 原始日志，保留原文便于排错。" DarkCyan

    try {
        Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -OutFile $installer
        Invoke-WebRequest -UseBasicParsing -Uri $hashUrl -OutFile $hashFile

        $expectedText = (Get-Content -LiteralPath $hashFile -Raw).Trim()
        $match = [regex]::Match($expectedText, "(?i)\b[0-9a-f]{64}\b")
        if (-not $match.Success) { throw "Rust 官方 SHA-256 文件格式无法识别。" }

        $expected = $match.Value.ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw ("Rustup SHA-256 校验失败。expected={0} actual={1}" -f $expected,$actual) }

        Write-Label "【校验】" "【通过】" "rustup-init.exe SHA-256 与 Rust 官方值一致。" Green

        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $installer -y --profile minimal --default-toolchain none
            $installCode = $LASTEXITCODE
        }
        finally { $ErrorActionPreference = $oldPreference }

        if ($installCode -ne 0) {
            Write-Label "【提示】" "【Rustup】" ("官方 rustup-init 退出码：{0}" -f $installCode) Yellow
            return $false
        }

        Add-CargoBinToCurrentPath
        return (-not [string]::IsNullOrWhiteSpace((Get-RustupCommandPath)))
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

function Ensure-ProjectRustToolchain {
    $rustupPath = Get-RustupCommandPath
    if ([string]::IsNullOrWhiteSpace($rustupPath)) { return $false }

    $channel = Get-ProjectRustChannel
    Add-CargoBinToCurrentPath

    Write-Label "【Rust】" "【版本】" ("项目要求 Rust {0}，正在确认。" -f $channel) Cyan
    Write-Label "【说明】" "【官方输出】" "后续 info: 英文为 Rust 官方 rustup 原始日志，保留原文便于排错。" DarkCyan

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $rustupPath toolchain install $channel --profile minimal --component rustfmt --component clippy
        $toolchainCode = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $oldPreference }

    if ($toolchainCode -ne 0) {
        Write-Label "【未完成】" "【Rust 项目版本】" ("无法准备项目要求的 Rust {0}。" -f $channel) Yellow
        return $false
    }

    Push-Location $ProjectRoot
    try {
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & cargo --version | Out-Host
            $cargoCode = $LASTEXITCODE
            & rustc --version | Out-Host
            $rustcCode = $LASTEXITCODE
        }
        finally { $ErrorActionPreference = $oldPreference }
    }
    finally { Pop-Location }

    return ($cargoCode -eq 0 -and $rustcCode -eq 0)
}

function Install-RustToolchainIfMissing {
    Add-CargoBinToCurrentPath

    $channel = Get-ProjectRustChannel
    $rustupPath = Get-RustupCommandPath
    $cargoPath = Get-CargoCommandPath

    if (-not [string]::IsNullOrWhiteSpace($rustupPath)) {
        Write-Label "【检测】" "【Rust】" ("已安装 | {0}" -f $rustupPath) Green

        if (Ensure-ProjectRustToolchain) {
            $cargoPath = Get-CargoCommandPath
            Write-Label "【完成】" "【Cargo】" ("{0} | {1}" -f (Get-CommandVersion "cargo"),$cargoPath) Green
            Write-Label "【完成】" "【rustc】" (Get-CommandVersion "rustc") Green
            return $true
        }

        return $false
    }

    if (-not [string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【检测】" "【Cargo】" ("已发现 | {0}" -f $cargoPath) Green
        Write-Label "【补齐】" "【Rust】" "缺少 rustup，将使用 Rust 官方安装器补齐版本管理能力。" Yellow
    }
    else {
        Write-Host ""
        Write-Label "【缺失】" "【Rust/Cargo】" "当前未安装 Rust，将自动使用 Rust 官方安装器。" Yellow
    }

    if (-not (Invoke-OfficialRustupInstaller)) {
        Write-Label "【未完成】" "【Rust/Cargo】" "Rust 官方安装器执行后仍未得到可用 rustup。" Yellow
        return $false
    }

    Add-CargoBinToCurrentPath

    if (-not (Ensure-ProjectRustToolchain)) {
        return $false
    }

    $cargoPath = Get-CargoCommandPath
    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【未完成】" "【Rust/Cargo】" "Rust 已尝试安装，但最终仍未找到 Cargo。" Yellow
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


function Get-ActiveLocalTcpPorts {
    try {
        return @(
            [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().
                GetActiveTcpListeners() |
                ForEach-Object { [int]$_.Port } |
                Sort-Object -Unique
        )
    }
    catch {
        return @()
    }
}

function Test-LfaaWebDevServer {
    param([int]$Port)

    $request = $null
    $response = $null
    $reader = $null

    try {
        $request = [System.Net.HttpWebRequest]::Create(
            ("http://127.0.0.1:{0}/__lfaa/dev/resources" -f $Port)
        )
        $request.Method = "GET"
        $request.Timeout = 350
        $request.ReadWriteTimeout = 350
        $request.KeepAlive = $false
        $request.Proxy = $null

        $response = $request.GetResponse()

        if ([int]$response.StatusCode -ne 200) {
            return $false
        }

        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $payload = $content | ConvertFrom-Json

        return $null -ne $payload.resources
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $reader) { $reader.Dispose() }
        if ($null -ne $response) { $response.Dispose() }
    }
}

function Resolve-LfaaWebDevPort {
    param(
        [int]$StartPort = 5173,
        [int]$EndPort = 5199
    )

    $activePorts = @(Get-ActiveLocalTcpPorts | Where-Object {
        $_ -ge $StartPort -and $_ -le $EndPort
    })

    # 只探测真正已经监听的端口。
    # 旧实现会对 5173-5199 每个端口做 1 秒 HTTP 超时，
    # 在没有任何 Web 服务时也可能白等二十多秒。
    foreach ($port in $activePorts) {
        if (Test-LfaaWebDevServer $port) {
            return [PSCustomObject]@{
                Mode = "reuse"
                Port = [int]$port
            }
        }
    }

    for ($port = $StartPort; $port -le $EndPort; $port++) {
        if ($activePorts -notcontains $port) {
            return [PSCustomObject]@{
                Mode = "start"
                Port = [int]$port
            }
        }
    }

    return $null
}

function Assert-WebDevelopmentDependencies {
    $required = @(
        "apps\web\node_modules\vite\package.json",
        "apps\web\node_modules\@xterm\xterm\package.json",
        "apps\web\node_modules\@xterm\addon-fit\package.json",
        "apps\web\node_modules\node-pty\package.json"
    )

    $missing = @()
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
            $missing += $relative
        }
    }

    if ($missing.Count -gt 0) {
        throw "Web 开发依赖未完整安装。请先运行菜单 1【一键依赖】，再启动 Web。"
    }
}

function Get-WebViteCommandPath {
    $candidates = @(
        (Join-Path $ProjectRoot "apps\web\node_modules\.bin\vite.cmd"),
        (Join-Path $ProjectRoot "node_modules\.bin\vite.cmd")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "未找到本地 Vite。请先运行菜单 1【一键依赖】准备项目依赖。"
}

function Invoke-WebViteForeground {
    param(
        [string]$ViteCommand,
        [string]$WorkingDirectory,
        [int]$Port
    )

    $code = 0
    $oldPort = $env:LFAA_WEB_PORT
    $env:LFAA_WEB_PORT = [string]$Port

    Push-Location $WorkingDirectory
    try {
        try {
            & $ViteCommand
            $code = $LASTEXITCODE
        }
        catch [System.Management.Automation.PipelineStoppedException] {
            $code = 130
        }
    }
    finally {
        Pop-Location

        if ($null -eq $oldPort) {
            Remove-Item Env:LFAA_WEB_PORT -ErrorAction SilentlyContinue
        }
        else {
            $env:LFAA_WEB_PORT = $oldPort
        }
    }

    if ($code -notin @(0,130,-1073741510)) {
        throw ("Web / Vite 开发服务器失败，退出码：{0}" -f $code)
    }

    Write-Host ""
    Write-Label "【停止】" "【Web】" "Vite 开发服务器已停止。" Green
}

function Start-WebDevelopment {
    Assert-WorkspaceScript "apps\web\package.json" "dev" "Web 端"
    Assert-WebDevelopmentDependencies

    Write-Host ""
    Write-Label "【检测】" "【Web】" "正在快速检查本地 Vite 端口..." DarkGray

    $resolved = Resolve-LfaaWebDevPort
    if ($null -eq $resolved) {
        throw "5173-5199 均被占用，无法为 LFAA Web 分配本地开发端口。"
    }

    $url = "http://127.0.0.1:{0}" -f $resolved.Port

    if ($resolved.Mode -eq "reuse") {
        Write-Label "【已运行】" "【Web】" ("已检测到 LFAA Vite：{0}" -f $url) Green
        Write-Label "【处理】" "【复用】" "直接复用现有服务，不重复启动。" Cyan
        try { Start-Process $url | Out-Null } catch {}
        return
    }

    if ($resolved.Port -ne 5173) {
        Write-Label "【端口】" "【5173 已占用】" ("自动改用 {0}；不会结束未知进程。" -f $resolved.Port) Yellow
    }

    $viteCommand = Get-WebViteCommandPath
    $webRoot = Join-Path $ProjectRoot "apps\web"

    Write-Label "【启动】" "【Web】" ("Vite：{0}" -f $url) Green
    Write-Label "【热插拔】" "【监听】" ".lfaa/skills、experts、plugins、extensions、mcp" Cyan
    Write-Label "【提示】" "【停止】" "按 Ctrl+C 停止 Web；停止后会返回主菜单。" DarkGray

    Invoke-WebViteForeground $viteCommand $webRoot $resolved.Port
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
    Write-Label "【1】" "【一键依赖】" "检查开发环境、自动补齐缺失工具、安装项目依赖并初始化 .lfaa。" Green
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

$firstMenu = $true

while ($true) {
    if (-not $firstMenu) {
        try { Clear-Host } catch {}
    }
    $firstMenu = $false

    Show-SetupMenu
    $choice = (Read-Host "【请选择】【0-10】").Trim()

    if ($choice -eq "0") {
        Write-Host ""
        Write-Label "【退出】" "【完成】" "已退出 LFAA 开发菜单。" Green
        exit 0
    }

    $menuMessage = "操作结束，按任意键返回主菜单。"

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
                    Write-Label "【预检】" "【Rust/Cargo】" "缺失；确认后自动使用 Rust 官方安装器补齐。" Yellow
                }

                if (-not (Confirm-WriteOperation "将检查并补齐开发环境；已安装的工具直接复用，缺失的自动安装。")) {
                    Write-Host ""
                    Write-Label "【取消】" "【一键依赖】" "用户已取消，本次未修改环境。" Yellow
                    $menuMessage = "已取消，按任意键返回主菜单。"
                    break
                }

                Install-NodeDependencies

                $cargoReady = Install-RustToolchainIfMissing
                if ($cargoReady) {
                    Install-RustDependencies
                }
                else {
                    Write-Label "【待补齐】" "【Rust/Cargo】" "Rust 环境尚未完成；Node/pnpm 环境已经准备好。" Yellow
                }

                Initialize-ProjectResources

                Write-Host ""
                Write-Label "【完成】" "【Node/pnpm】" "项目 Node 依赖已确认。" Green

                if ($cargoReady) {
                    Write-Label "【完成】" "【Rust/Cargo】" "Rust 工具链和当前已声明 Rust 依赖已确认。" Green
                    $menuMessage = "依赖准备完成，按任意键返回主菜单。"
                }
                else {
                    Write-Label "【部分完成】" "【Rust/Cargo】" "Rust 自动安装未完成，请查看上方具体原因。" Yellow
                    $menuMessage = "依赖部分完成，按任意键返回主菜单。"
                }
            }

            "2" {
                Start-WebDevelopment
                $menuMessage = "Web 操作已结束，按任意键返回主菜单。"
            }

            "3" {
                Start-DesktopDevelopment
                $menuMessage = "Desktop 操作已结束，按任意键返回主菜单。"
            }

            "4" {
                Build-Web
                $menuMessage = "Web 构建完成，按任意键返回主菜单。"
            }

            "5" {
                Build-Desktop
                $menuMessage = "Desktop 构建完成，按任意键返回主菜单。"
            }

            "6" {
                Build-AndReleaseAll
                $menuMessage = "构建发布操作完成，按任意键返回主菜单。"
            }

            "7" {
                Show-Environment
                $menuMessage = "环境检查完成，按任意键返回主菜单。"
            }

            "8" {
                if (-not (Confirm-WriteOperation "将在当前项目创建缺失的 .lfaa 目录。")) {
                    Write-Host ""
                    Write-Label "【取消】" "【项目资源】" "用户已取消，本次未修改项目资源。" Yellow
                    $menuMessage = "已取消，按任意键返回主菜单。"
                    break
                }

                Initialize-ProjectResources
                $menuMessage = "项目资源检查完成，按任意键返回主菜单。"
            }

            "9" {
                Invoke-PnpmScript "governance:check"
                $menuMessage = "治理检查完成，按任意键返回主菜单。"
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

                $menuMessage = "完整检查完成，按任意键返回主菜单。"
            }

            default {
                throw "无效选项，请输入 0 到 10。"
            }
        }
    }
    catch {
        Write-Host ""
        Write-Label "【错误】" "【失败】" ([string]$_.Exception.Message) Red
        $menuMessage = "操作未完成，按任意键返回主菜单。"
    }

    Wait-LfaaMenu $menuMessage
}
