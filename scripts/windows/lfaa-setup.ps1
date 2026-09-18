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

function Get-PnpmRunner {
    if (Test-CommandAvailable "pnpm") {
        return [PSCustomObject]@{ FilePath="pnpm"; Prefix=@() }
    }
    if (Test-CommandAvailable "corepack") {
        return [PSCustomObject]@{ FilePath="corepack"; Prefix=@("pnpm") }
    }
    throw "未检测到 pnpm 或 corepack。请先安装项目要求的 Node.js 工具链。"
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
    Write-Label "【环境】" "【Node】" (Get-CommandVersion "node") Gray
    Write-Label "【环境】" "【corepack】" (Get-CommandVersion "corepack") Gray
    Write-Label "【环境】" "【pnpm】" (Get-CommandVersion "pnpm") Gray
    Write-Label "【环境】" "【cargo】" (Get-CommandVersion "cargo") Gray
    Write-Label "【环境】" "【rustc】" (Get-CommandVersion "rustc") Gray
    Write-Label "【规则】" "【包管理器】" "Node.js workspace 只允许 pnpm。" Green
}

function Install-NodeDependencies {
    if (-not (Test-CommandAvailable "node")) { throw "未检测到 Node.js。" }
    $args = @("install")
    if (Test-Path (Join-Path $ProjectRoot "pnpm-lock.yaml")) { $args += "--frozen-lockfile" }
    Invoke-Pnpm $args "下载 pnpm workspace 项目依赖"
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

function Install-RustToolchainIfMissing {
    $cargoPath = Get-CargoCommandPath
    if (-not [string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【环境】" "【Rust/Cargo】" "已安装，直接复用。" Green
        return $true
    }

    Write-Host ""
    Write-Label "【缺失】" "【Rust/Cargo】" "后续 Desktop / Native Core 会使用 Rust，当前未检测到 Cargo。" Yellow

    if (-not (Test-CommandAvailable "winget")) {
        Write-Label "【无法自动安装】" "【winget】" "当前系统未检测到 winget；本次先完成 Node/pnpm 依赖。" Yellow
        return $false
    }

    Write-Label "【准备安装】" "【Rustup】" "将通过 Windows 官方包管理器 winget 安装 Rustlang.Rustup。" Cyan
    Write-Label "【说明】" "【系统工具】" "这是系统级开发工具，不会安装到项目目录。" DarkCyan

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

    if ($wingetCode -ne 0) {
        Write-Label "【提示】" "【Rust】" "Rustup 自动安装未完成；Node/pnpm 依赖不会受影响。" Yellow
        return $false
    }

    Add-CargoBinToCurrentPath

    $rustupPath = Get-RustupCommandPath
    if (-not [string]::IsNullOrWhiteSpace($rustupPath)) {
        Write-Label "【Rust】" "【工具链】" "正在确认 stable toolchain..." Cyan
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        try {
            & $rustupPath default stable
            $rustupCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $oldPreference
        }

        if ($rustupCode -ne 0) {
            Write-Label "【提示】" "【Rust】" "Rustup 已安装，但 stable toolchain 初始化未完成。" Yellow
        }
    }

    Add-CargoBinToCurrentPath
    $cargoPath = Get-CargoCommandPath

    if ([string]::IsNullOrWhiteSpace($cargoPath)) {
        Write-Label "【提示】" "【Rust】" "Rustup 安装完成后当前终端仍未找到 Cargo；重新打开终端后会再次检测。" Yellow
        return $false
    }

    Write-Label "【完成】" "【Rust/Cargo】" "Rust 工具链已准备完成。" Green
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


function Test-NodeDependencyToolchain {
    return (Test-CommandAvailable "node") -and (
        (Test-CommandAvailable "pnpm") -or
        (Test-CommandAvailable "corepack")
    )
}

function Test-RustDependencyToolchain {
    return -not [string]::IsNullOrWhiteSpace((Get-CargoCommandPath))
}

function Show-SetupMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 开发环境、项目依赖与质量检查菜单" -ForegroundColor Cyan
    Write-Host " 作者：二鱼" -ForegroundColor DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【一键准备】" "检查环境、补齐 Rust/Cargo、安装全部已声明依赖并初始化项目资源。" Green
    Write-Label "【2】" "【环境检查】" "查看项目根、工具链和 pnpm 状态。" Cyan
    Write-Label "【3】" "【Node 依赖】" "只下载 pnpm workspace 依赖。" Cyan
    Write-Label "【4】" "【Rust 依赖】" "只下载 Cargo workspace 依赖。" Cyan
    Write-Label "【5】" "【项目资源】" "初始化当前项目 .lfaa 目录。" Magenta
    Write-Label "【6】" "【治理检查】" "运行治理和导入边界检查。" Magenta
    Write-Label "【7】" "【类型检查】" "运行 typecheck。" Yellow
    Write-Label "【8】" "【测试】" "运行 test。" Yellow
    Write-Label "【9】" "【构建】" "运行 build。" Yellow
    Write-Label "【10】" "【完整检查】" "运行治理、类型、测试、构建和 Rust 检查。" Green
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
            Write-Label "【预检】" "【Node/pnpm】" "可用，将复用现有工具链和已下载依赖。" Green

            $cargoReadyBefore = Test-RustDependencyToolchain
            if ($cargoReadyBefore) {
                Write-Label "【预检】" "【Rust/Cargo】" "可用，将复用现有 Rust 工具链。" Green
            }
            else {
                Write-Label "【预检】" "【Rust/Cargo】" "缺失；确认后将尝试通过 winget 安装 Rustup。" Yellow
            }

            if (-not (Confirm-WriteOperation "将准备当前项目开发环境：pnpm 安装会复用已下载内容；如缺少 Rust/Cargo，将尝试通过 winget 安装 Rustup。")) {
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

            Wait-LfaaClose $true "Node/pnpm 依赖已完成；Rust 自动安装未完成时可重新运行菜单 1 继续补齐。"
            exit 0
        }
        "2" { Show-Environment }
        "3" {
            if (-not (Confirm-WriteOperation "将在当前项目下载 pnpm workspace 依赖。")) { Wait-LfaaClose $true; exit 0 }
            Install-NodeDependencies
        }
        "4" {
            if (-not (Confirm-WriteOperation "将在当前项目下载 Cargo workspace 依赖。")) { Wait-LfaaClose $true; exit 0 }
            Install-RustDependencies
        }
        "5" {
            if (-not (Confirm-WriteOperation "将在当前项目创建缺失的 .lfaa 目录。")) { Wait-LfaaClose $true; exit 0 }
            Initialize-ProjectResources
        }
        "6" { Invoke-GovernanceChecks }
        "7" { Invoke-PnpmScript "typecheck" }
        "8" { Invoke-PnpmScript "test" }
        "9" { Invoke-PnpmScript "build" }
        "10" {
            Invoke-GovernanceChecks
            Invoke-PnpmScript "typecheck"
            Invoke-PnpmScript "test"
            Invoke-PnpmScript "build"
            Invoke-ProjectCommand "cargo" @("check","--workspace") "运行 Rust cargo check"
            Invoke-ProjectCommand "cargo" @("test","--workspace") "运行 Rust cargo test"
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
