# Copyright (c) 2026 二鱼.
# Part of the LFAA project.
#
# 文件：lfaa-setup.ps1
# 作用：提供 LFAA 项目依赖、项目级资源和开发质量检查菜单。
# 负责：Node/Rust 依赖下载、环境检查、.lfaa 目录初始化和统一检查入口。
# 不负责：安装 Node/Rust 工具链、安装用户级资源、绕过项目质量门禁。

$ErrorActionPreference = "Stop"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\.."))

function Write-Label {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right,
        [Parameter(Mandatory = $true)][string]$Text,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )

    Write-Host ("{0}{1} " -f $Left, $Right) -ForegroundColor $Color -NoNewline
    Write-Host $Text
}

function Wait-LfaaClose {
    param([Parameter(Mandatory = $true)][bool]$Success)

    Write-Host ""
    if ($Success) {
        Write-Label "【提示】" "【可关闭】" "全部操作已完成，现在可以安全关闭终端窗口。" Green
    }
    else {
        Write-Label "【提示】" "【可关闭】" "操作未完成；处理上方问题后可重新运行。" Yellow
    }

    Write-Label "【提示】" "【操作】" "按任意键关闭窗口，或直接点击右上角 X。" DarkGray
    try { [void][System.Console]::ReadKey($true) } catch {}
}

function Stop-Lfaa {
    param([Parameter(Mandatory = $true)][string]$Message)

    Write-Host ""
    Write-Label "【错误】" "【ERROR】" $Message Red
    Wait-LfaaClose -Success $false
    exit 1
}

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandVersion {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Test-CommandAvailable $Name)) {
        return "未安装"
    }

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = @(& $Name --version 2>&1 | ForEach-Object { [string]$_ })
        if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) {
            return "已发现，但无法读取版本"
        }
        return ($output -join " ").Trim()
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }
}

function Get-PnpmRunner {
    if (Test-CommandAvailable "pnpm") {
        return [PSCustomObject]@{
            FilePath = "pnpm"
            Prefix = @()
            Display = "pnpm"
        }
    }

    if (Test-CommandAvailable "corepack") {
        return [PSCustomObject]@{
            FilePath = "corepack"
            Prefix = @("pnpm")
            Display = "corepack pnpm"
        }
    }

    throw "未检测到 pnpm 或 corepack。请先安装项目要求的 Node.js 工具链。"
}

function Invoke-ProjectCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description
    )

    Write-Host ""
    Write-Label "【执行】" "【COMMAND】" $Description Cyan
    Push-Location $ProjectRoot
    try {
        & $FilePath @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($exitCode -ne 0) {
        throw ("{0}失败，退出码：{1}" -f $Description, $exitCode)
    }
}

function Invoke-Pnpm {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $runner = Get-PnpmRunner
    $allArguments = @($runner.Prefix) + $Arguments
    Invoke-ProjectCommand -FilePath $runner.FilePath -Arguments $allArguments -Description $Description
}

function Confirm-WriteOperation {
    param([Parameter(Mandatory = $true)][string]$Description)

    Write-Host ""
    Write-Label "【写操作】" "【说明】" $Description Yellow
    $answer = Read-Host "【确认】【继续】输入 Y 确认，其他键取消"
    return $answer -match "^(?i:y|yes)$"
}

function Show-Environment {
    Write-Host ""
    Write-Label "【项目】" "【ROOT】" $ProjectRoot Cyan
    Write-Label "【环境】" "【Node】" (Get-CommandVersion "node") Gray
    Write-Label "【环境】" "【npm】" (Get-CommandVersion "npm") Gray
    Write-Label "【环境】" "【corepack】" (Get-CommandVersion "corepack") Gray
    Write-Label "【环境】" "【pnpm】" (Get-CommandVersion "pnpm") Gray
    Write-Label "【环境】" "【cargo】" (Get-CommandVersion "cargo") Gray
    Write-Label "【环境】" "【rustc】" (Get-CommandVersion "rustc") Gray

    $nodeLock = Test-Path -LiteralPath (Join-Path $ProjectRoot "pnpm-lock.yaml")
    $cargoLock = Test-Path -LiteralPath (Join-Path $ProjectRoot "Cargo.lock")
    Write-Label "【锁定】" "【pnpm】" $(if ($nodeLock) { "pnpm-lock.yaml 已存在" } else { "pnpm-lock.yaml 尚未建立" }) $(if ($nodeLock) { "Green" } else { "Yellow" })
    Write-Label "【锁定】" "【Cargo】" $(if ($cargoLock) { "Cargo.lock 已存在" } else { "Cargo.lock 尚未建立" }) $(if ($cargoLock) { "Green" } else { "Yellow" })
}

function Install-NodeDependencies {
    if (-not (Test-CommandAvailable "node")) {
        throw "未检测到 Node.js。"
    }

    $arguments = @("install")
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot "pnpm-lock.yaml")) {
        $arguments += "--frozen-lockfile"
    }
    else {
        Write-Label "【提醒】" "【LOCKFILE】" "首次安装将生成 pnpm-lock.yaml；生成后必须提交。" Yellow
    }

    Invoke-Pnpm -Arguments $arguments -Description "下载 Node/pnpm 项目依赖"
}

function Install-RustDependencies {
    if (-not (Test-CommandAvailable "cargo")) {
        throw "未检测到 Cargo。请先安装项目锁定的 Rust 工具链。"
    }

    $arguments = @("fetch")
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot "Cargo.lock")) {
        $arguments += "--locked"
    }
    else {
        Write-Label "【提醒】" "【LOCKFILE】" "首次获取将生成 Cargo.lock；生成后必须提交。" Yellow
    }

    Invoke-ProjectCommand -FilePath "cargo" -Arguments $arguments -Description "下载 Rust/Cargo 项目依赖"
}

function Initialize-ProjectResources {
    $resourceRoot = Join-Path $ProjectRoot ".lfaa"
    $directories = @(
        "skills",
        "experts",
        "plugins",
        "extensions",
        "mcp",
        "cache",
        "state",
        "tmp",
        "logs"
    )

    foreach ($directory in $directories) {
        $path = Join-Path $resourceRoot $directory
        if (-not (Test-Path -LiteralPath $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Write-Label "【创建】" "【PROJECT】" (".lfaa/{0}" -f $directory) Green
        }
        else {
            Write-Label "【存在】" "【PROJECT】" (".lfaa/{0}" -f $directory) DarkGray
        }
    }

    Write-Label "【边界】" "【确认】" "项目资源只位于当前项目 .lfaa/；未写入用户级目录。" Green
}

function Test-ProjectResourceManifest {
    foreach ($name in @("manifest.json", "lock.json")) {
        $path = Join-Path (Join-Path $ProjectRoot ".lfaa") $name
        if (-not (Test-Path -LiteralPath $path)) {
            throw ("缺少项目资源文件：.lfaa/{0}" -f $name)
        }

        $data = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ($data.scope -ne "project" -or $null -eq $data.resources) {
            throw ("项目资源文件格式无效：.lfaa/{0}" -f $name)
        }
    }

    Write-Label "【资源】" "【LOCK】" "项目级 manifest/lock 检查通过。" Green
}

function Invoke-GovernanceChecks {
    if (-not (Test-CommandAvailable "node")) {
        throw "未检测到 Node.js，无法运行治理检查。"
    }

    Invoke-ProjectCommand -FilePath "node" -Arguments @("scripts/governance-check.mjs") -Description "运行项目治理检查"
    Invoke-ProjectCommand -FilePath "node" -Arguments @("scripts/import-path-check.mjs") -Description "运行导入边界检查"
}

function Invoke-PnpmScript {
    param([Parameter(Mandatory = $true)][string]$Name)
    Invoke-Pnpm -Arguments @("run", $Name) -Description ("运行 {0}" -f $Name)
}

function Invoke-FullValidation {
    Invoke-GovernanceChecks
    Invoke-PnpmScript "typecheck"
    Invoke-PnpmScript "test"
    Invoke-PnpmScript "build"

    if (-not (Test-CommandAvailable "cargo")) {
        throw "未检测到 Cargo，完整检查不能跳过 Rust workspace。"
    }

    Invoke-ProjectCommand -FilePath "cargo" -Arguments @("check", "--workspace") -Description "运行 Rust cargo check"
    Invoke-ProjectCommand -FilePath "cargo" -Arguments @("test", "--workspace") -Description "运行 Rust cargo test"
}

function Show-SetupMenu {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host " LFAA 开发环境、项目依赖与质量检查菜单" -ForegroundColor Cyan
    Write-Host " 作者：二鱼" -ForegroundColor DarkCyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Label "【1】" "【全部依赖】" "一键下载 Node/pnpm 与 Rust/Cargo 项目依赖。" Green
    Write-Label "【2】" "【环境检查】" "查看项目根、工具链和 lockfile 状态。" Cyan
    Write-Label "【3】" "【Node 依赖】" "只下载 pnpm workspace 依赖。" Cyan
    Write-Label "【4】" "【Rust 依赖】" "只下载 Cargo workspace 依赖。" Cyan
    Write-Label "【5】" "【项目资源】" "初始化当前项目 .lfaa 资源与运行目录。" Magenta
    Write-Label "【6】" "【治理检查】" "运行文档治理和导入边界检查。" Magenta
    Write-Label "【7】" "【类型检查】" "运行真实 TypeScript typecheck；未配置时明确失败。" Yellow
    Write-Label "【8】" "【测试】" "运行真实测试；未配置时明确失败。" Yellow
    Write-Label "【9】" "【构建】" "运行真实 build；未配置时明确失败。" Yellow
    Write-Label "【10】" "【完整检查】" "依次运行治理、类型、测试、构建和 Rust 检查。" Green
    Write-Label "【0】" "【退出】" "不执行任何操作。" DarkGray
    Write-Host ""
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "lfaa.release.json"))) {
    Stop-Lfaa "脚本所在目录不是有效的 LFAA 项目根。"
}

Show-SetupMenu
$choice = (Read-Host "【请选择】【0-10】").Trim()

try {
    switch ($choice) {
        "1" {
            if (-not (Test-CommandAvailable "node") -or
                (-not (Test-CommandAvailable "pnpm") -and -not (Test-CommandAvailable "corepack")) -or
                -not (Test-CommandAvailable "cargo")) {
                Show-Environment
                throw "全部依赖安装要求 Node、pnpm/corepack 和 Cargo 均已安装；本次未写入依赖。"
            }
            if (-not (Confirm-WriteOperation "将在当前项目下载 Node 与 Rust 依赖，不写入用户级 LFAA 资源目录。")) {
                Write-Label "【取消】" "【完成】" "用户取消，未下载依赖。" Yellow
                Wait-LfaaClose -Success $true
                exit 0
            }
            Install-NodeDependencies
            Install-RustDependencies
            Initialize-ProjectResources
            Test-ProjectResourceManifest
        }
        "2" { Show-Environment }
        "3" {
            if (-not (Confirm-WriteOperation "将在当前项目下载 pnpm workspace 依赖。")) {
                Write-Label "【取消】" "【完成】" "用户取消，未下载依赖。" Yellow
                Wait-LfaaClose -Success $true
                exit 0
            }
            Install-NodeDependencies
        }
        "4" {
            if (-not (Confirm-WriteOperation "将在当前项目下载 Cargo workspace 依赖。")) {
                Write-Label "【取消】" "【完成】" "用户取消，未下载依赖。" Yellow
                Wait-LfaaClose -Success $true
                exit 0
            }
            Install-RustDependencies
        }
        "5" {
            if (-not (Confirm-WriteOperation "将在当前项目根创建缺失的 .lfaa 目录，不写入用户级目录。")) {
                Write-Label "【取消】" "【完成】" "用户取消，未创建目录。" Yellow
                Wait-LfaaClose -Success $true
                exit 0
            }
            Initialize-ProjectResources
            Test-ProjectResourceManifest
        }
        "6" { Invoke-GovernanceChecks }
        "7" { Invoke-PnpmScript "typecheck" }
        "8" { Invoke-PnpmScript "test" }
        "9" { Invoke-PnpmScript "build" }
        "10" { Invoke-FullValidation }
        "0" {
            Write-Label "【退出】" "【完成】" "未执行任何操作。" Green
            Wait-LfaaClose -Success $true
            exit 0
        }
        default { throw "无效选项，请输入 0 到 10。" }
    }
}
catch {
    Stop-Lfaa ([string]$_.Exception.Message)
}

Write-Host ""
Write-Label "【完成】" "【SUCCESS】" "所选操作已完成。" Green
Wait-LfaaClose -Success $true
exit 0
