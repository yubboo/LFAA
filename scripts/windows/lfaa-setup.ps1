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
    param([bool]$Success)
    Write-Host ""
    if ($Success) {
        Write-Label "【提示】" "【可关闭】" "全部操作已完成，现在可以安全关闭终端窗口。" Green
    } else {
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

function Install-RustDependencies {
    if (-not (Test-CommandAvailable "cargo")) { throw "未检测到 Cargo。" }
    $args = @("fetch")
    if (Test-Path (Join-Path $ProjectRoot "Cargo.lock")) { $args += "--locked" }
    Invoke-ProjectCommand "cargo" $args "下载 Rust/Cargo 项目依赖"
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

function Show-SetupMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 开发环境、项目依赖与质量检查菜单" -ForegroundColor Cyan
    Write-Host " 作者：二鱼" -ForegroundColor DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【全部依赖】" "下载 pnpm 与 Rust/Cargo 项目依赖。" Green
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
            if (-not (Confirm-WriteOperation "将在当前项目下载 pnpm 与 Rust 依赖。")) { Wait-LfaaClose $true; exit 0 }
            Install-NodeDependencies
            Install-RustDependencies
            Initialize-ProjectResources
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
