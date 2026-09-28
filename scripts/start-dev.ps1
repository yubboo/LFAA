<#
功能：启动 LFAA 前端、server 和本机 daemon 的开发进程。
作用：检查运行环境与已安装依赖，并在当前窗口并行运行三项服务，或运行指定的单个服务。
关联文件：根目录 package.json、scripts/install-dependencies.ps1、frontend/package.json、server/package.json、daemon/package.json。
#>

[CmdletBinding()]
param(
    [ValidateSet('Launch', 'Service')]
    [string]$Mode = 'Launch',

    [ValidateSet('server', 'frontend', 'daemon')]
    [string]$Service
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$rootManifestPath = Join-Path $projectRoot 'package.json'
$script:ServiceExitCode = 0

function Get-StartupContext {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('server', 'frontend', 'daemon')]
        [string]$RequiredService
    )

    if (-not (Test-Path -LiteralPath $rootManifestPath)) {
        throw '找不到根目录 package.json。'
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'pnpm-workspace.yaml'))) {
        throw '找不到 pnpm-workspace.yaml，无法启动工作区服务。'
    }

    $manifest = Get-Content -LiteralPath $rootManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $requiredNodeVersion = [version]'24.15.0'
    $nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw '未检测到 Node.js，请先安装 Node.js 24.15.0 或更新版本。'
    }

    $nodeVersionOutput = (& $nodeCommand.Source --version 2>$null | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0 -or [string]$nodeVersionOutput -notmatch '^v?(\d+)\.(\d+)\.(\d+)') {
        throw '无法读取 Node.js 版本。'
    }

    $nodeVersion = [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
    if ($nodeVersion -lt $requiredNodeVersion) {
        throw "当前 Node.js 为 $nodeVersion，项目要求 $requiredNodeVersion 或更新版本。"
    }

    if ($RequiredService -eq 'daemon') {
        $cargoCommand = Get-Command 'cargo' -ErrorAction SilentlyContinue
        $rustupCommand = Get-Command 'rustup' -ErrorAction SilentlyContinue
        if (-not $cargoCommand -or -not $rustupCommand) {
            throw 'Windows Daemon 需要 Rust stable MSVC 工具链和 rustup；当前未检测到 Cargo/rustup。'
        }

        $rustTargets = @(& $rustupCommand.Source target list --installed 2>$null)
        if ($LASTEXITCODE -ne 0 -or $rustTargets -notcontains 'x86_64-pc-windows-msvc') {
            throw 'Windows Daemon 需要 Rust target x86_64-pc-windows-msvc；请先安装该 target。'
        }
    }

    $serviceScriptName = "dev:$RequiredService"
    if (-not $manifest.scripts.PSObject.Properties[$serviceScriptName]) {
        throw "根目录 package.json 缺少 $serviceScriptName 启动脚本。"
    }

    $requiredDependency = switch ($RequiredService) {
        'frontend' { Join-Path $projectRoot 'frontend/node_modules/vite/package.json' }
        'server' { Join-Path $projectRoot 'server/node_modules/tsx/package.json' }
        'daemon' { Join-Path $projectRoot 'daemon/src/task-runner/minecraft-daemon.mjs' }
    }
    if (-not (Test-Path -LiteralPath $requiredDependency)) {
        throw '开发依赖或 daemon 入口尚未准备好；请先在菜单中选择“1”安装依赖。'
    }

    $expectedPnpmVersion = ([string]$manifest.packageManager -replace '^pnpm@', '')
    if (-not $expectedPnpmVersion) {
        throw '根目录 package.json 未指定项目要求的 pnpm 版本。'
    }

    $pnpmCommand = Get-Command 'pnpm' -ErrorAction SilentlyContinue
    $corepackCommand = Get-Command 'corepack' -ErrorAction SilentlyContinue
    $selectedExecutable = $null
    $selectedPrefix = @()

    if ($pnpmCommand) {
        $installedVersion = (& $pnpmCommand.Source --version 2>$null | Select-Object -Last 1)
        if ($LASTEXITCODE -eq 0 -and ([string]$installedVersion).Trim() -eq $expectedPnpmVersion) {
            $selectedExecutable = $pnpmCommand.Source
        }
    }

    if (-not $selectedExecutable -and $corepackCommand) {
        $corepackVersion = (& $corepackCommand.Source pnpm --version 2>$null | Select-Object -Last 1)
        if ($LASTEXITCODE -eq 0 -and ([string]$corepackVersion).Trim() -eq $expectedPnpmVersion) {
            $selectedExecutable = $corepackCommand.Source
            $selectedPrefix = @('pnpm')
        }
    }

    if (-not $selectedExecutable) {
        throw "未检测到可运行项目指定 pnpm $expectedPnpmVersion 的 pnpm 或 Corepack。"
    }

    return [PSCustomObject]@{
        Executable = $selectedExecutable
        Prefix = $selectedPrefix
    }
}

function Invoke-DevelopmentScript {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('dev', 'dev:server', 'dev:frontend', 'dev:daemon')]
        [string]$ScriptName,

        [Parameter(Mandatory = $true)]
        [PSCustomObject]$StartupContext
    )

    $arguments = @()
    if ($StartupContext.Prefix.Count -gt 0) {
        $arguments += $StartupContext.Prefix
    }
    $arguments += @('run', $ScriptName)

    Set-Location -LiteralPath $projectRoot
    & $StartupContext.Executable @arguments
    $script:ServiceExitCode = $LASTEXITCODE
}

if ($Mode -eq 'Service') {
    if (-not $Service) {
        throw '服务终端缺少服务名称。'
    }

    $serviceTitle = switch ($Service) { 'server' { 'LFAA 后端服务' } 'frontend' { 'LFAA 前端服务' } 'daemon' { 'LFAA 本机 Daemon' } }
    try {
        $Host.UI.RawUI.WindowTitle = $serviceTitle
    }
    catch {
        # 某些终端宿主不支持设置窗口标题；不影响服务启动。
    }

    try {
        $startupContext = Get-StartupContext -RequiredService $Service
        Write-Host "正在启动 LFAA $Service，请查看本窗口的运行日志。" -ForegroundColor Cyan
        $scriptName = "dev:$Service"
        Invoke-DevelopmentScript -ScriptName $scriptName -StartupContext $startupContext
        $serviceExitCode = $script:ServiceExitCode
        if ($serviceExitCode -ne 0) {
            Write-Host "服务已退出，退出代码：$serviceExitCode" -ForegroundColor Red
        }
        else {
            Write-Host '服务已停止。' -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "无法启动服务：$($_.Exception.Message)" -ForegroundColor Red
    }

    return
}

try {
    $startupContext = Get-StartupContext -RequiredService 'server'
    $null = Get-StartupContext -RequiredService 'frontend'
    $null = Get-StartupContext -RequiredService 'daemon'
}
catch {
    Write-Host "启动检查未通过：$($_.Exception.Message)" -ForegroundColor Red
    return
}

Write-Host '前端、server 和本机 Daemon 将在当前窗口中同时启动；按 Ctrl+C 停止三个服务。' -ForegroundColor Cyan
Invoke-DevelopmentScript -ScriptName 'dev' -StartupContext $startupContext

if ($script:ServiceExitCode -ne 0) {
    Write-Host "开发服务已退出，退出代码：$script:ServiceExitCode" -ForegroundColor Red
}
else {
    Write-Host '前端、server 和本机 Daemon 已停止。' -ForegroundColor Yellow
}
