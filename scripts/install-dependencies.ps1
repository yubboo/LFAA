<#
功能：显示 LFAA 项目主菜单并按用户选择执行操作。
作用：安装与构建当前包工作区、选择 Harness 运行入口、检查环境、备份源码或推送 GitHub。
关联文件：lfaa.bat、scripts/project-menu.mjs、scripts/backup-project.ps1、scripts/start-dev.ps1、apps/cli/bin/lfaa.mjs、apps/web/package.json、apps/web/scripts/wait-for-server.mjs、packages/util/home-paths/src/resolve-data-directory.mjs、packages/storage/storage-json/src/index.ts、package.json、pnpm-workspace.yaml。
#>

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$rootManifest = Join-Path $projectRoot 'package.json'
$workspaceFile = Join-Path $projectRoot 'pnpm-workspace.yaml'

# Git 默认按 core.quotePath 把含非 ASCII 的路径转义成 "\345\274\200..." 形式。
# 这种字符串一旦回传给 Git 当路径用就会报 "Invalid path"，也会让敏感路径规则匹配失败，
# 因此所有 Git 调用统一关闭路径转义，保证中文路径在输出与入参之间原样往返。
$gitCommonArguments = @('-c', 'core.quotePath=false')

# 菜单是常驻进程：脚本在启动时就已读入内存，之后改动文件不会影响正在运行的菜单。
# 记录本次加载时间，便于判断当前菜单跑的是哪一版脚本。
$scriptLoadedAt = (Get-Item -LiteralPath $PSCommandPath).LastWriteTime

function Show-MainMenu {
    Clear-Host
    Write-Host ''
    Write-Host '╔══════════════════════════════════════════════╗' -ForegroundColor DarkCyan
    Write-Host '║              LFAA Harness 工作台             ║' -ForegroundColor Cyan
    Write-Host '╚══════════════════════════════════════════════╝' -ForegroundColor DarkCyan
    Write-Host ''
    Write-Host '请选择要执行的操作：' -ForegroundColor White
    Write-Host '  【1】安装工作区依赖：pnpm install' -ForegroundColor Green
    Write-Host '  【2】启动 Harness：Web（自动托管本机 Daemon）/ 独立节点 / 开发模式 / Vite 热更新' -ForegroundColor Magenta
    Write-Host '  【3】构建 Windows Electron 桌面安装包' -ForegroundColor Cyan
    Write-Host '  【4】检查环境与实际工作区包' -ForegroundColor Yellow
    Write-Host '  【5】一键生成纯净源码 ZIP（排除依赖与敏感数据）' -ForegroundColor Green
    Write-Host '  【6】一键正常推送 GitHub main（不覆盖远端历史）' -ForegroundColor Green
    Write-Host '  【7】一键强制推送 GitHub main（覆盖远端历史）' -ForegroundColor Red
    Write-Host '  【0】退出' -ForegroundColor Red
    Write-Host ''
    Write-Host '桌面安装版内置 Control Plane 与本机 Daemon，并自动启动；Web 在 Windows 默认托管本机 Daemon。' -ForegroundColor DarkGray
    Write-Host '独立节点模式用于远程节点或维护；Windows Sandbox Host 由桌面打包自动构建，单独构建命令只针对该原生宿主。' -ForegroundColor DarkGray
    Write-Host '菜单 3 等同 pnpm run build:win；安装包输出：dist/apps/desktop-electron/。' -ForegroundColor DarkGray
    Write-Host '首次沿用待构建版本；之后每次新包会要求填写更新说明并递增版本。' -ForegroundColor DarkGray
    Write-Host 'Web 启动前检查源码与构建是否一致。' -ForegroundColor DarkGray
    Write-Host '服务在当前终端运行，按 Ctrl+C 停止；不另开服务窗口。' -ForegroundColor DarkGray
    Write-Host ("脚本加载于 {0:yyyy-MM-dd HH:mm}；若刚改过脚本，请按 0 退出并重新打开本菜单。" -f $scriptLoadedAt) -ForegroundColor DarkGray
}

function Get-ProjectManifest {
    if (-not (Test-Path -LiteralPath $rootManifest)) {
        throw '找不到根目录 package.json。'
    }

    return (Get-Content -LiteralPath $rootManifest -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Show-EnvironmentStatus {
    Write-Host ''
    Write-Host '【环境检查】' -ForegroundColor Cyan

    $nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $nodeVersion = (& $nodeCommand.Source --version).Trim()
        Write-Host "  Node.js：$nodeVersion" -ForegroundColor Green
    }
    else {
        Write-Host '  未检测到 Node.js。' -ForegroundColor Red
    }

    try {
        $manifest = Get-ProjectManifest
        $expectedVersion = ([string]$manifest.packageManager -replace '^pnpm@', '')
        Write-Host "  项目要求 Node.js：$($manifest.engines.node)；pnpm：$expectedVersion" -ForegroundColor Cyan
    }
    catch {
        Write-Host "  项目配置：$($_.Exception.Message)" -ForegroundColor Red
    }

    $pnpmCommand = Get-Command 'pnpm' -ErrorAction SilentlyContinue
    if ($pnpmCommand) {
        $installedVersion = (& $pnpmCommand.Source --version 2>$null).Trim()
        Write-Host "  当前 pnpm：$installedVersion" -ForegroundColor $(if ($installedVersion -eq $expectedVersion) { 'Green' } else { 'Yellow' })
    }
    elseif (Get-Command 'corepack' -ErrorAction SilentlyContinue) {
        Write-Host '  未检测到独立 pnpm；安装时可由 Corepack 获取项目指定版本。' -ForegroundColor Yellow
    }
    else {
        Write-Host '  未检测到 pnpm 或 Corepack。' -ForegroundColor Red
    }

    if (Test-Path -LiteralPath $workspaceFile) {
        Write-Host '  pnpm 工作区配置：已找到' -ForegroundColor Green
    }
    else {
        Write-Host '  pnpm 工作区配置：缺失' -ForegroundColor Red
    }

    $rustcCommand = Get-Command 'rustc' -ErrorAction SilentlyContinue
    $cargoCommand = Get-Command 'cargo' -ErrorAction SilentlyContinue
    $rustupCommand = Get-Command 'rustup' -ErrorAction SilentlyContinue
    if ($rustcCommand -and $cargoCommand -and $rustupCommand) {
        $rustVersion = (& $rustcCommand.Source --version 2>$null | Select-Object -Last 1)
        $rustTargets = @(& $rustupCommand.Source target list --installed 2>$null)
        if ($LASTEXITCODE -eq 0 -and $rustTargets -contains 'x86_64-pc-windows-msvc') {
            Write-Host "  Rust/Cargo：$rustVersion；Windows x64 MSVC target 已安装" -ForegroundColor Green
        }
        else {
            Write-Host "  Rust/Cargo：$rustVersion；缺少 x86_64-pc-windows-msvc target" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host '  未检测到 Rust/Cargo/rustup；构建或启动 Windows Daemon 沙盒 Host 需要 Rust stable 与 x86_64-pc-windows-msvc target。' -ForegroundColor Yellow
    }
}

function Show-DependencyScope {
    Write-Host ''
    Write-Host '【当前安装范围】' -ForegroundColor Cyan

    # 按真实工作区 manifest 列出启动工具及能力包；目录占位不安装依赖。
    $manifests = @()
    foreach ($appDirectory in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'apps') -Directory) {
        $manifestPath = Join-Path $appDirectory.FullName 'package.json'
        if (Test-Path -LiteralPath $manifestPath) { $manifests += $manifestPath }
    }
    foreach ($group in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'packages') -Directory) {
        foreach ($packageDirectory in Get-ChildItem -LiteralPath $group.FullName -Directory) {
            $manifestPath = Join-Path $packageDirectory.FullName 'package.json'
            if (Test-Path -LiteralPath $manifestPath) { $manifests += $manifestPath }
        }
    }
    foreach ($manifestPath in $manifests | Sort-Object) {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $directory = (Split-Path -Parent $manifestPath).Substring($projectRoot.Length + 1)
        Write-Host "  【Node.js】$directory（$($manifest.name)）" -ForegroundColor Green
    }

    Write-Host '  【不由 pnpm 管理】Daemon Windows AppContainer Sandbox Host 需要 Rust；普通 Web 安装、构建和启动不需要 Rust。' -ForegroundColor DarkYellow
}

function Start-Harness {
    Write-Host '【启动模式】' -ForegroundColor Cyan
    Write-Host '  【1】Web（默认）'
    Write-Host '  【2】独立 Daemon 节点（远程主机/节点维护）'
    Write-Host '  【3】开发模式'
    Write-Host '  【4】Vite 热更新前端（5173，复用已运行控制端）'
    Write-Host '  【0】返回'
    $mode = [string](Read-Host '输入编号并按 Enter（默认 1）')
    switch ($mode.Trim()) {
        '0' { return }
        '3' { Start-DevelopmentServices; return }
        '4' {
            Write-Host 'Vite 会等待当前控制端健康就绪后启动，只提供前端热更新，不重启控制端或 Daemon。' -ForegroundColor Cyan
            Write-Host '启动后打开 http://127.0.0.1:5173/apps/minecraft/ai-work；按 Ctrl+C 停止 Vite。' -ForegroundColor DarkGray
            Start-ViteFrontend
            return
        }
        '2' { $profile = 'daemon' }
        '1' { $profile = 'web' }
        '' { $profile = 'web' }
        default { throw '无效启动模式，请选择 1、2、3、4 或 0。' }
    }
    # 正式 CLI 不处理数据目录迁移；有待处理计划时禁止继续使用旧位置写数据。
    if (Test-Path -LiteralPath (Join-Path $projectRoot '.lfaa-data-directory.pending.json')) {
        throw '存在待处理的数据目录迁移。请停止正在运行的服务，使用开发模式或 pnpm dev 完成迁移后再启动 CLI。'
    }
    if ($profile -eq 'daemon') {
        Write-Host '此项单独启动节点进程；桌面安装版会自动启动本机 Daemon。Windows AppContainer Sandbox Host 可用 pnpm run build:windows-sandbox-host 构建，Electron 桌面打包会自动内置。' -ForegroundColor Yellow
    }
    # 只重建已经过期的职责输出，禁止在源码更新后静默启动旧版本。
    $nodeCommand = Get-Command 'node' -ErrorAction Stop
    $staleJson = & $nodeCommand.Source (Join-Path $projectRoot 'scripts/runtime-build-state.mjs') $profile
    if ($LASTEXITCODE -ne 0) { throw '无法检查正式运行树，请先执行菜单 3 构建。' }
    $staleBuilds = @($staleJson | ConvertFrom-Json)
    if ($staleBuilds -contains 'host') {
        Write-Host '控制端构建缺失或源码已更新，正在构建当前实现。' -ForegroundColor Yellow
        Invoke-WorkspacePnpm -Arguments @('run', 'build:control-plane')
    }
    if ($staleBuilds -contains 'web') {
        Write-Host 'Web 构建缺失或源码已更新，正在构建当前实现。' -ForegroundColor Yellow
        Invoke-WorkspacePnpm -Arguments @('run', 'build:web')
    }
    if ($profile -eq 'web') {
        Stop-ExistingLfaaWebLockOwner
    }
    Invoke-WorkspacePnpm -Arguments @('lfaa', $profile)
}

function Start-DevelopmentServices {
    $startupScript = Join-Path $PSScriptRoot 'start-dev.ps1'
    if (-not (Test-Path -LiteralPath $startupScript)) {
        Write-Host '找不到开发服务启动脚本。' -ForegroundColor Red
        return
    }

    & $startupScript -Mode Launch
}

function Start-ProjectBackup {
    $backupScript = Join-Path $PSScriptRoot 'backup-project.ps1'
    if (-not (Test-Path -LiteralPath $backupScript)) {
        Write-Host '找不到项目备份脚本。' -ForegroundColor Red
        return
    }

    try {
        & $backupScript
    }
    catch {
        Write-Host "项目备份失败：$($_.Exception.Message)（脚本行号：$($_.InvocationInfo.ScriptLineNumber)）" -ForegroundColor Red
    }
}

function Get-WorkspacePnpm {
    if (-not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
        throw '未检测到 Node.js，请先安装项目要求的 Node.js。'
    }

    if (-not (Test-Path -LiteralPath $workspaceFile)) {
        throw '未找到 pnpm-workspace.yaml，无法执行工作区命令。'
    }

    $manifest = Get-ProjectManifest
    $nodeVersion = [version]((& node --version).Trim().TrimStart('v'))
    if ([string]$manifest.engines.node -notmatch '^>=(\d+\.\d+\.\d+)$') {
        throw '根目录 package.json 的 Node.js 最低版本格式无效。'
    }
    if ($nodeVersion -lt [version]$Matches[1]) {
        throw "当前 Node.js 为 $nodeVersion，项目要求 $($manifest.engines.node)。"
    }
    $packageManagerSpec = [string]$manifest.packageManager
    if ($packageManagerSpec -notmatch '^pnpm@(.+)$') {
        throw '根目录 package.json 未指定有效的 pnpm 版本。'
    }
    $expectedPnpmVersion = $Matches[1]

    $pnpmCommand = Get-Command 'pnpm' -ErrorAction SilentlyContinue
    $corepackCommand = Get-Command 'corepack' -ErrorAction SilentlyContinue
    $useCorepack = $false

    if ($pnpmCommand) {
        $installedVersion = (& $pnpmCommand.Source --version 2>$null).Trim()
        if ($LASTEXITCODE -eq 0 -and $installedVersion -eq $expectedPnpmVersion) {
            Write-Host "检测到 Node.js：$((& node --version).Trim())" -ForegroundColor Cyan
            Write-Host "使用 pnpm：$installedVersion" -ForegroundColor Cyan
        }
        elseif ($corepackCommand) {
            $useCorepack = $true
        }
        else {
            throw "当前 pnpm 与项目要求的 $expectedPnpmVersion 不一致，且未检测到 Corepack。"
        }
    }
    elseif ($corepackCommand) {
        $useCorepack = $true
    }
    else {
        throw '未检测到 pnpm 或 Corepack，请先安装项目指定的 pnpm。'
    }

    if ($useCorepack) {
        Write-Host "由 Corepack 获取并运行 pnpm $expectedPnpmVersion。" -ForegroundColor Yellow
        $actualVersion = (& $corepackCommand.Source pnpm --version 2>$null | Select-Object -Last 1)
        if ($LASTEXITCODE -ne 0 -or ([string]$actualVersion).Trim() -ne $expectedPnpmVersion) {
            throw 'Corepack 未能运行项目指定的 pnpm 版本。'
        }
        return @{ Executable = $corepackCommand.Source; Prefix = @('pnpm') }
    }
    return @{ Executable = $pnpmCommand.Source; Prefix = @() }
}

function Invoke-WorkspacePnpm {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    Set-Location -LiteralPath $projectRoot
    $invocation = Get-WorkspacePnpm
    $commandArguments = @($invocation.Prefix) + $Arguments
    Write-Host "执行：pnpm $($Arguments -join ' ')" -ForegroundColor Cyan
    & $invocation.Executable @commandArguments
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm 命令结束，退出代码：$LASTEXITCODE。"
    }
}

function Start-ViteFrontend {
    Set-Location -LiteralPath $projectRoot
    $nodeCommand = Get-Command 'node' -ErrorAction Stop
    $cliManifestPath = Join-Path $projectRoot 'apps\cli\package.json'
    if (-not (Test-Path -LiteralPath $cliManifestPath)) {
        throw '未找到 LFAA CLI 运行时清单，无法核对 Node.js 要求。'
    }

    $workspaceManifest = Get-ProjectManifest
    $cliManifest = Get-Content -LiteralPath $cliManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    # 根清单若未声明 Node.js 下限，沿用 CLI 的运行时要求，避免另写固定版本。
    $nodeRequirement = [string]$workspaceManifest.engines.node
    if ([string]::IsNullOrWhiteSpace($nodeRequirement)) {
        $nodeRequirement = [string]$cliManifest.engines.node
    }
    if ($nodeRequirement -notmatch '^>=(\d+\.\d+\.\d+)$') {
        throw 'apps/cli/package.json 的 Node.js 最低版本格式无效。'
    }
    $minimumNodeVersion = [version]$Matches[1]
    $installedNodeVersion = [version]((& $nodeCommand.Source --version).Trim().TrimStart('v'))
    if ($installedNodeVersion -lt $minimumNodeVersion) {
        throw "当前 Node.js 为 $installedNodeVersion，项目要求 $nodeRequirement。"
    }

    $pnpmCommand = Get-Command 'pnpm' -ErrorAction Stop
    $pnpmVersion = (& $pnpmCommand.Source --version 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pnpmVersion)) {
        throw '无法读取当前 pnpm 版本，Vite 未启动。'
    }
    $packageManagerSpec = [string]$workspaceManifest.packageManager
    if (-not [string]::IsNullOrWhiteSpace($packageManagerSpec)) {
        if ($packageManagerSpec -notmatch '^pnpm@(.+)$') {
            throw '根目录 package.json 的 packageManager 不是有效 pnpm 声明。'
        }
        if ($pnpmVersion -ne $Matches[1]) {
            throw "当前 pnpm 为 $pnpmVersion，工作区要求 $($Matches[1])。"
        }
    }
    else {
        Write-Host '当前根清单未固定 pnpm 版本，使用 PATH 中可用的 pnpm。' -ForegroundColor Yellow
    }

    # 本工作区的 Vite 已占用默认端口时直接复用；身份不明的占用者只报告，不终止、不换端口。
    $portListeners = @(Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue)
    if ($portListeners.Count -gt 0) {
        $projectPath = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd('\')
        $unverifiedListeners = @()
        foreach ($ownerPid in @($portListeners | Select-Object -ExpandProperty OwningProcess -Unique)) {
            $owner = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ownerPid" -ErrorAction SilentlyContinue
            $commandLine = if ($null -eq $owner) { '' } else { ([string]$owner.CommandLine).Replace('/', '\') }
            $isCurrentWorkspaceVite = $null -ne $owner -and
                $owner.Name -match '^node(?:\.exe)?$' -and
                $commandLine.IndexOf($projectPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
                $commandLine -match '(?i)(?:^|[\\/])vite[\\/]bin[\\/]vite\.js(?:["\s]|$)'
            if (-not $isCurrentWorkspaceVite) {
                $processName = if ($null -eq $owner) { '进程信息不可用' } else { [string]$owner.Name }
                $unverifiedListeners += "PID $ownerPid（$processName）"
            }
        }

        if ($unverifiedListeners.Count -gt 0) {
            throw "端口 5173 已被无法确认属于当前工作区 Vite 的进程占用：$($unverifiedListeners -join '、')。未启动新进程，也未停止占用者。"
        }

        $viteReady = $false
        $lastViteCheckError = ''
        for ($attempt = 0; $attempt -lt 12; $attempt++) {
            try {
                $viteResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/apps/minecraft/ai-work' -TimeoutSec 2 -UseBasicParsing -Headers @{ Accept = 'text/html' } -ErrorAction Stop
                if ([int]$viteResponse.StatusCode -eq 200) {
                    $viteReady = $true
                    break
                }
                $lastViteCheckError = "HTTP $([int]$viteResponse.StatusCode)"
            }
            catch {
                $lastViteCheckError = $_.Exception.Message
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $viteReady) {
            throw "检测到当前工作区 Vite 正在监听 5173，但 AI Work 页面未就绪：$lastViteCheckError"
        }

        Write-Host '检测到当前工作区 Vite 已就绪，复用 http://127.0.0.1:5173/apps/minecraft/ai-work；不会再启动第二个实例。' -ForegroundColor Green
        return
    }

    Write-Host "使用 Node.js $installedNodeVersion 与 pnpm $pnpmVersion。" -ForegroundColor Cyan
    Write-Host '执行：pnpm --filter lfaa-web run dev' -ForegroundColor Cyan
    & $pnpmCommand.Source '--filter' 'lfaa-web' 'run' 'dev'
    if ($LASTEXITCODE -ne 0) {
        throw "Vite 前端结束，退出代码：$LASTEXITCODE。"
    }
}

function Get-ResolvedDataDirectory {
    # 与 CLI 共用同一数据目录解析器和 .env 优先级，定位写锁时不自行推导默认路径。
    $nodeCommand = Get-Command 'node' -ErrorAction Stop
    $resolverSource = @'
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const environmentFile = process.argv[1];
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
const resolverFile = pathToFileURL(resolve(process.argv[2])).href;
const { resolveDataDirectory } = await import(resolverFile);
console.log(resolveDataDirectory(process.argv[3], process.env.LFAA_DATA_DIR || "data"));
'@
    $environmentFile = Join-Path $projectRoot '.env'
    $resolverFile = Join-Path $projectRoot 'packages\util\home-paths\src\resolve-data-directory.mjs'
    $resolverOutput = @(& $nodeCommand.Source '--input-type=module' '--eval' $resolverSource $environmentFile $resolverFile $projectRoot 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "无法解析当前 LFAA 数据目录：$($resolverOutput -join ' ')"
    }

    $dataDirectory = [string]($resolverOutput | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($dataDirectory)) {
        throw '数据目录解析没有返回路径，已停止 Web 启动。'
    }
    return $dataDirectory.Trim()
}

function Read-ConfigurationLockRecord {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        $record = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "LFAA 配置写锁格式无效，未尝试结束进程：$Path"
    }

    $processId = [long]0
    $identity = [guid]::Empty
    if (-not [long]::TryParse([string]$record.pid, [ref]$processId) -or $processId -lt 1 -or
        -not [guid]::TryParse([string]$record.identity, [ref]$identity)) {
        throw "LFAA 配置写锁缺少有效 PID 或身份标识，未尝试结束进程：$Path"
    }
    return [pscustomobject]@{ ProcessId = $processId; Identity = $identity.ToString() }
}

function Stop-ExistingLfaaWebLockOwner {
    # 只协调可确认的 Web 写锁持有者；锁释放仍由存储 Owner 事务处理。
    $dataDirectory = Get-ResolvedDataDirectory
    $lockPath = Join-Path (Join-Path $dataDirectory 'storages') '.configuration.lock'
    $lockRecord = Read-ConfigurationLockRecord -Path $lockPath
    if ($null -eq $lockRecord) { return }

    $owner = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($lockRecord.ProcessId)" -ErrorAction Stop
    if ($null -eq $owner) {
        Write-Host '配置写锁记录的 PID 已退出；由存储模块在启动事务中安全回收。' -ForegroundColor Yellow
        return
    }

    $ownerCommandLine = [string]$owner.CommandLine
    $normalizedCommandLine = $ownerCommandLine.Replace('/', '\')
    if ($owner.Name -notmatch '^node(?:\.exe)?$' -or
        $normalizedCommandLine -notmatch '(?i)apps\\cli\\bin\\lfaa\.mjs' -or
        $ownerCommandLine -notmatch '(?i)(?:^|[\s"])web(?:$|[\s"])') {
        throw "数据目录写锁 PID $($lockRecord.ProcessId) 仍存活，但无法确认为 LFAA Web CLI；为避免误杀，已停止启动。"
    }

    $currentLockRecord = Read-ConfigurationLockRecord -Path $lockPath
    if ($null -eq $currentLockRecord) { return }
    if ($currentLockRecord.ProcessId -ne $lockRecord.ProcessId -or $currentLockRecord.Identity -ne $lockRecord.Identity) {
        throw 'Web 启动期间配置写锁归属发生变化，已停止启动。'
    }

    $currentOwner = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($lockRecord.ProcessId)" -ErrorAction Stop
    if ($null -eq $currentOwner) { return }
    if ($currentOwner.Name -ne $owner.Name -or
        [string]$currentOwner.CommandLine -ne $ownerCommandLine -or
        [string]$currentOwner.CreationDate -ne [string]$owner.CreationDate) {
        throw 'Web 启动期间锁持有进程身份发生变化，已停止启动。'
    }

    Write-Host "检测到当前数据目录由 LFAA Web PID $($lockRecord.ProcessId) 占用，正在结束该进程并重新启动 Web。" -ForegroundColor Yellow
    Stop-Process -Id $lockRecord.ProcessId -Force -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (-not (Get-Process -Id $lockRecord.ProcessId -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 125
    }
    throw "未能确认 LFAA Web PID $($lockRecord.ProcessId) 已退出，已停止重启。"
}

function Install-WorkspaceDependencies {
    Invoke-WorkspacePnpm -Arguments @('install')
    Write-Host 'pnpm 工作区依赖安装成功，锁文件已写入根目录。' -ForegroundColor Green
}

function ConvertTo-NativeGitArguments {
    param([string[]]$Arguments)

    # PowerShell 5.1 组装原生命令行时不会转义参数里已有的双引号，裸引号会被 C 运行时吃掉：
    # 含引号的正则会静默失配（敏感内容扫描形同虚设），提交说明里的引号会直接丢字。
    # 这里按原生命令行规则补成 \"，让 Git 收到参数原文。
    return @($Arguments | ForEach-Object { $_.Replace('"', '\"') })
}

function Assert-NativeGitArgumentPassing {
    # 自检：确认参数里的双引号能完整送达 Git。
    # 传参一旦被破坏，敏感内容扫描会以「无匹配」静默通过，所以这里必须大声失败而不是继续推送。
    $probeArgument = 'lfaa"probe'
    $escapedProbeArgument = @(ConvertTo-NativeGitArguments -Arguments @($probeArgument))[0]
    $receivedArgument = @(& git @gitCommonArguments -C $projectRoot rev-parse --sq-quote $escapedProbeArgument 2>$null) -join ''
    if ($receivedArgument -notmatch '"') {
        throw 'Git 参数传递自检失败：命令行会吃掉参数里的双引号，敏感内容扫描结果不可信，已阻止推送。'
    }
}

function Invoke-GitOutput {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)

    $nativeArguments = @(ConvertTo-NativeGitArguments -Arguments $GitArguments)
    $lines = @(& git @gitCommonArguments -C $projectRoot @nativeArguments 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ("Git 命令失败（退出代码 {0}）：git {1}`n{2}" -f $exitCode, ($GitArguments -join ' '), ($lines -join "`n"))
    }

    return $lines
}

function Invoke-GitChecked {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)

    $nativeArguments = @(ConvertTo-NativeGitArguments -Arguments $GitArguments)
    & git @gitCommonArguments -C $projectRoot @nativeArguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ("Git 命令失败（退出代码 {0}）：git {1}" -f $exitCode, ($GitArguments -join ' '))
    }
}

function Get-GitConfigValue {
    param([Parameter(Mandatory = $true)][string]$Key)

    $nativeArguments = @(ConvertTo-NativeGitArguments -Arguments @('config', '--get', $Key))
    $lines = @(& git @gitCommonArguments -C $projectRoot @nativeArguments 2>$null | ForEach-Object { [string]$_ })
    if ($LASTEXITCODE -ne 0) {
        return ''
    }

    return ($lines -join "`n").Trim()
}

function Get-BlockedGitPaths {
    param([string[]]$Paths)

    return @($Paths | Where-Object {
        $path = $_ -replace '\\', '/'
        # packages/credentials 是版本化第一方源码包；其他 credentials 目录仍视为本机凭据数据。
        $sourceCredentialsPackage = $path -match '(?i)^packages/credentials(?:/|$)'
        # 运行数据目录一律不得推送：根 data/、server/data/、apps/*/data/。
        $path -match '(?i)^(data|server/data)/' -or
        $path -match '(?i)^apps/[^/]+/data/' -or
        $path -match '(?i)(^|/)(dist|node_modules|target|build|coverage|\.cache|\.turbo|\.next|\.vite|\.output|\.pnpm-store|\.venv|venv|__pycache__|\.tox|\.nox|bower_components|pods|carthage|vendor|backups|secrets?|database|\.ssh|\.aws|\.azure|\.kube)(/|$)' -or
        (($path -match '(?i)(^|/)credentials(/|$)') -and -not $sourceCredentialsPackage) -or
        (($path -match '(?i)(^|/)\.env($|\.)') -and ($path -notmatch '(?i)(^|/)\.env\.example$')) -or
        $path -match '(?i)\.(sqlite3?|db)([-.][a-z0-9_-]+)?$' -or
        $path -match '(?i)\.(log|key|pem|p8|p12|pfx|jks|keystore|crt|cer|cert|der|token|secret|secrets|zip|7z|rar|tar|tgz|gz|whl|exe|msi|dll|node|so|dylib|class|jar|wasm|o|obj|pdb|ilk|lib|a|onnx|pt|pth|safetensors|gguf)$' -or
        $path -match '(?i)(^|/)(\.npmrc|\.pypirc|\.netrc|\.git-credentials|credentials\.json|secrets\.json|token\.json|auth\.json|service-account[^/]*)$' -or
        $path -match '(?i)(^|/)(id_rsa|id_ed25519|id_ecdsa|id_dsa)$' -or
        $path -match '(?i)\.tsbuildinfo$'
    })
}

function Get-LargeGitObjectPaths {
    param([string[]]$ObjectLines)

    $maximumBytes = 25MB
    if ($ObjectLines.Count -eq 0) {
        return @()
    }

    $objectDetails = @($ObjectLines | & git @gitCommonArguments -C $projectRoot cat-file '--batch-check=%(objecttype) %(objectsize) %(rest)' 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw '无法读取 Git 对象大小，已阻止推送。'
    }

    $largePaths = New-Object System.Collections.Generic.List[string]
    foreach ($detail in $objectDetails) {
        if ($detail -match '^blob ([0-9]+) (.+)$' -and [long]$Matches[1] -gt $maximumBytes) {
            $sizeMiB = [math]::Round(([long]$Matches[1] / 1MB), 1)
            $largePaths.Add(("{0}（{1} MiB）" -f $Matches[2], $sizeMiB))
        }
    }

    return @($largePaths | Select-Object -Unique)
}

function Get-GitIndexObjectLines {
    param([string[]]$Paths)

    if ($Paths.Count -eq 0) {
        return @()
    }

    $wantedPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($path in $Paths) {
        [void]$wantedPaths.Add($path)
    }

    # 一次读取整个索引再在本地按路径筛选。
    # 逐条路径调用 Git 会为每个文件启动一次进程，暂存文件上千时明显拖慢推送前的检查。
    $objectLines = New-Object System.Collections.Generic.List[string]
    foreach ($entry in (Invoke-GitOutput -GitArguments @('ls-files', '--stage'))) {
        if ($entry -match '^[0-7]+ ([0-9a-f]+) 0\t(.+)$') {
            $entryPath = $Matches[2]
            if ($wantedPaths.Contains($entryPath)) {
                $objectLines.Add(("{0} {1}" -f $Matches[1], $entryPath))
            }
        }
    }

    return @($objectLines)
}

function Get-GitSecretPatterns {
    # Blocking 表示该模式命中即可判定为真实凭据，直接阻止推送；
    # 末尾的通用赋值启发式会把测试夹具（测试进程自设的 JWT_SECRET、测试账号口令）也算进来，
    # 因此只报告给用户确认，不直接阻断。
    return @(
        [PSCustomObject]@{ Name = '私钥标记'; Regex = ('-----BEGIN ' + '(RSA |EC |OPENSSH )?PRIVATE KEY-----'); Blocking = $true },
        [PSCustomObject]@{ Name = '云服务访问密钥'; Regex = ('AKIA' + '[0-9A-Z]{16}'); Blocking = $true },
        [PSCustomObject]@{ Name = 'GitHub 访问令牌'; Regex = ('github_pat_' + '[A-Za-z0-9_]{22,}|gh[pousr]_' + '[A-Za-z0-9_]{20,}'); Blocking = $true },
        [PSCustomObject]@{ Name = '模型服务令牌'; Regex = ('sk-' + '[A-Za-z0-9_-]{32,}'); Blocking = $true },
        [PSCustomObject]@{ Name = '明文凭据赋值'; Regex = '(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|jwt[_-]?secret|account[_-]?key|shared[_-]?access[_-]?signature|password)[[:space:]]*[:=][[:space:]]*["'']?[A-Za-z0-9/+_=-]{24,}'; IgnoreCase = $true; Blocking = $false }
    )
}

function Get-GitSecretFindings {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('Index', 'History')][string]$Scope,
        [string[]]$Paths = @()
    )

    # 分两类收集：精确凭据阻断推送，通用赋值启发式交用户确认。
    # 用字符串列表而不是对象列表：PowerShell 5.1 对 List[object] 装 PSCustomObject 再转数组会抛类型异常。
    $blockingFindings = New-Object System.Collections.Generic.List[string]
    $advisoryFindings = New-Object System.Collections.Generic.List[string]
    $seenFindings = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($definition in (Get-GitSecretPatterns)) {
        # 每个模式对应一到多次 Git 扫描；暂存文件多时按批拆分，
        # 避免把上千条路径一次性塞进命令行而触发 Windows 命令行长度上限。
        $argumentSets = [System.Collections.Generic.List[string[]]]::new()
        if ($Scope -eq 'Index') {
            $scanPaths = @($Paths)
            if ($definition.Name -eq '明文凭据赋值') {
                $scanPaths = @($scanPaths | Where-Object { $_ -notmatch '(^|/)\.env\.example$' })
            }
            if ($scanPaths.Count -eq 0) {
                continue
            }

            $batchSize = 100
            for ($offset = 0; $offset -lt $scanPaths.Count; $offset += $batchSize) {
                $end = [Math]::Min($offset + $batchSize - 1, $scanPaths.Count - 1)
                $batch = @($scanPaths[$offset..$end])
                $gitArguments = @('grep', '--cached', '-I', '-l', '-E')
                if ($definition.IgnoreCase) {
                    $gitArguments += '-i'
                }
                $gitArguments += @('-e', $definition.Regex, '--') + $batch
                $argumentSets.Add([string[]]$gitArguments)
            }
        }
        else {
            $gitArguments = @('log', '--format=%h')
            if ($definition.IgnoreCase) {
                $gitArguments += '-i'
            }
            $gitArguments += @(("-G{0}" -f $definition.Regex), 'HEAD', '--')
            $argumentSets.Add([string[]]$gitArguments)
        }

        foreach ($argumentSet in $argumentSets) {
            # 正则里含双引号，必须先转义再传，否则会被命令行吃掉而静默漏检。
            $nativeArgumentSet = @(ConvertTo-NativeGitArguments -Arguments $argumentSet)
            $gitMatches = @(& git @gitCommonArguments -C $projectRoot @nativeArgumentSet 2>$null | ForEach-Object { [string]$_ })
            $exitCode = $LASTEXITCODE
            if ($exitCode -eq 0) {
                foreach ($gitMatch in $gitMatches) {
                    if ($seenFindings.Add(("{0}|{1}" -f $gitMatch, $definition.Name))) {
                        $findingText = ("{0} [{1}]" -f $gitMatch, $definition.Name)
                        if ($definition.Blocking) {
                            $blockingFindings.Add($findingText)
                        }
                        else {
                            $advisoryFindings.Add($findingText)
                        }
                    }
                }
            }
            elseif ($exitCode -ne 1) {
                throw ("高风险敏感内容扫描失败（{0}），已阻止推送。" -f $definition.Name)
            }
        }
    }

    return @{
        Blocking = @($blockingFindings)
        Advisory = @($advisoryFindings)
    }
}

function Assert-GitSecretFindings {
    param(
        [Parameter(Mandatory = $true)][string]$ScopeLabel,
        [string[]]$Blocking = @(),
        [string[]]$Advisory = @()
    )

    # 精确凭据模式一旦命中即判定为真实凭据，直接阻断。
    if ($Blocking.Count -gt 0) {
        Write-Host ("{0}检测到高风险凭据标记；为避免泄露，未输出匹配内容并已阻止推送：" -f $ScopeLabel) -ForegroundColor Red
        foreach ($finding in $Blocking) {
            Write-Host "  $finding" -ForegroundColor DarkYellow
        }
        throw '请从源码中移除真实凭据后重新推送。'
    }

    # 通用赋值启发式（形如「KEY = 长串」）无法区分测试夹具与真实凭据，
    # 而测试夹具是必须提交的源码，所以这里只做醒目提示、不阻断、不追问，推送照常继续。
    # 真正危险的凭据由上面的精确模式负责拦截。
    if ($Advisory.Count -eq 0) {
        return
    }

    Write-Host ("{0}提示：{1} 处形如「KEY = 长串」的赋值，通常是测试夹具，也可能是真实凭据（未输出匹配内容）：" -f $ScopeLabel, $Advisory.Count) -ForegroundColor Yellow
    foreach ($finding in ($Advisory | Select-Object -First 10)) {
        Write-Host "  $finding" -ForegroundColor Yellow
    }
    if ($Advisory.Count -gt 10) {
        Write-Host ("  ...另有 {0} 处" -f ($Advisory.Count - 10)) -ForegroundColor Yellow
    }
    Write-Host '  如其中含真实凭据，请按 Ctrl+C 中止并先移除；否则本次继续推送。' -ForegroundColor DarkGray
}

function Set-GitHubOrigin {
    $targetUrl = 'https://github.com/yubboo/LFAA.git'
    $remotes = @(Invoke-GitOutput -GitArguments @('remote'))

    if ($remotes -notcontains 'origin') {
        Invoke-GitChecked -GitArguments @('remote', 'add', 'origin', $targetUrl)
    }

    Invoke-GitChecked -GitArguments @('config', '--replace-all', 'remote.origin.url', $targetUrl)
    # 清除可能存在的多个 push URL，保证强推只发往用户指定的 GitHub 仓库。
    Invoke-GitChecked -GitArguments @('config', '--replace-all', 'remote.origin.pushurl', $targetUrl)
    Write-Host "origin 与推送地址已固定为：$targetUrl" -ForegroundColor Green
}

function Get-ProjectReleaseVersion {
    $manifest = Get-ProjectManifest
    $projectName = ([string]$manifest.name).Split('/')[-1].ToUpperInvariant()
    $updateLogPath = Join-Path $projectRoot 'docs\updata-log.md'
    if (-not (Test-Path -LiteralPath $updateLogPath -PathType Leaf)) {
        throw '找不到 docs\updata-log.md，无法确定本次推送版本。'
    }

    $updateLog = Get-Content -LiteralPath $updateLogPath -Raw -Encoding UTF8
    $versionPattern = '(?m)^\s*-\s*\*\*项目版本：\*\*\s*`' + [regex]::Escape($projectName) + '\s+(?<version>\d+\.\d+\.\d+)`'
    $versionMatch = [regex]::Match($updateLog, $versionPattern)
    if (-not $versionMatch.Success) {
        throw '无法从 docs\updata-log.md 最新记录中读取项目版本。'
    }

    return [PSCustomObject]@{
        Name = $projectName
        Number = $versionMatch.Groups['version'].Value
        Label = ("{0} {1}" -f $projectName, $versionMatch.Groups['version'].Value)
    }
}

function Read-Confirmation {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [switch]$DefaultYes
    )

    $hint = if ($DefaultYes) { '(Y/n)' } else { '(y/N)' }
    while ($true) {
        $answerInput = (Read-Host ("{0} {1}" -f $Prompt, $hint)).Trim()
        if ([string]::IsNullOrWhiteSpace($answerInput)) {
            return [bool]$DefaultYes.IsPresent
        }
        if ($answerInput -imatch '^(y|yes|是)$') { return $true }
        if ($answerInput -imatch '^(n|no|否)$') { return $false }
        Write-Host '请输入 y 或 n。' -ForegroundColor Yellow
    }
}

function Push-GitHubRepository {
    param([switch]$Force)

    $isForcePush = $Force.IsPresent
    $pushModeLabel = if ($isForcePush) { '强制推送' } else { '正常推送' }
    Write-Host ''
    Write-Host ("【GitHub {0}】" -f $pushModeLabel) -ForegroundColor $(if ($isForcePush) { 'Red' } else { 'Green' })
    Write-Host '目标：https://github.com/yubboo/LFAA.git' -ForegroundColor Cyan
    Write-Host '分支：main' -ForegroundColor Cyan
    # 先说明后续步骤，避免用户在凭据确认处取消后以为漏了「提交说明」这一步。
    Write-Host '流程：排除依赖与敏感数据 → 扫描凭据 → 输入提交说明 → 创建提交 → 推送到 main。' -ForegroundColor DarkGray

    if (-not (Get-Command 'git' -ErrorAction SilentlyContinue)) {
        Write-Host '未检测到 Git for Windows，请先安装 Git 并加入 PATH。' -ForegroundColor Red
        return
    }

    # 参数传递被破坏时敏感内容扫描会静默漏检；先自检再询问用户，避免白确认一次。
    try {
        Assert-NativeGitArgumentPassing
    }
    catch {
        Write-Host "GitHub 推送失败：$($_.Exception.Message)" -ForegroundColor Red
        return
    }

    if ($isForcePush) {
        Write-Host '强制推送会用本地当前提交覆盖 GitHub main 的提交历史。' -ForegroundColor Yellow
        # 只做一次 y/n 确认；取消时不暂存、不提交，也不连接远端。
        if (-not (Read-Confirmation -Prompt '确认强制推送并覆盖远端 main 历史？')) {
            Write-Host '已取消强制推送。' -ForegroundColor DarkGray
            return
        }
    }
    else {
        Write-Host '常规推送不会覆盖远端历史；若远端领先，Git 会安全拒绝本次推送。' -ForegroundColor Green
        if (-not (Read-Confirmation -Prompt '确认推送到 GitHub main？' -DefaultYes)) {
            Write-Host '已取消推送。' -ForegroundColor DarkGray
            return
        }
    }

    try {
        $projectVersion = Get-ProjectReleaseVersion

        $gitDirectory = Join-Path $projectRoot '.git'
        if (-not (Test-Path -LiteralPath $gitDirectory)) {
            Write-Host '当前目录还没有 Git 仓库，正在初始化 main 分支……' -ForegroundColor Cyan
            Invoke-GitChecked -GitArguments @('init')
            Invoke-GitChecked -GitArguments @('symbolic-ref', 'HEAD', 'refs/heads/main')
        }

        $gitRoot = ((Invoke-GitOutput -GitArguments @('rev-parse', '--show-toplevel')) -join "`n").Trim()
        if ([System.IO.Path]::GetFullPath($gitRoot) -ne [System.IO.Path]::GetFullPath($projectRoot)) {
            throw "Git 根目录不是当前 LFAA 工作区：$gitRoot"
        }

        $gitName = Get-GitConfigValue -Key 'user.name'
        if ([string]::IsNullOrWhiteSpace($gitName)) {
            $gitName = (Read-Host '请输入 Git 提交显示名称').Trim()
            if ([string]::IsNullOrWhiteSpace($gitName)) {
                throw 'Git 提交显示名称不能为空。'
            }
            Invoke-GitChecked -GitArguments @('config', 'user.name', $gitName)
        }

        $gitEmail = Get-GitConfigValue -Key 'user.email'
        if ([string]::IsNullOrWhiteSpace($gitEmail)) {
            $gitEmail = (Read-Host '请输入 Git 提交邮箱').Trim()
            if ([string]::IsNullOrWhiteSpace($gitEmail)) {
                throw 'Git 提交邮箱不能为空。'
            }
            Invoke-GitChecked -GitArguments @('config', 'user.email', $gitEmail)
        }

        Set-GitHubOrigin

        $commitCreated = $false
        $workingChanges = @(Invoke-GitOutput -GitArguments @('status', '--short', '--untracked-files=all'))
        if ($workingChanges.Count -gt 0) {
            Write-Host ''
            Write-Host '检测到以下工作区变化：' -ForegroundColor Cyan
            foreach ($change in $workingChanges) {
                Write-Host "  $change"
            }

            Invoke-GitChecked -GitArguments @('add', '-A')

            # 忽略规则不是安全边界；再次检查暂存区并保留被排除的本地文件。
            $stagedPaths = @(Invoke-GitOutput -GitArguments @('diff', '--cached', '--name-only'))
            $blockedPaths = @(Get-BlockedGitPaths -Paths $stagedPaths)
            $stagedObjectLines = @(Get-GitIndexObjectLines -Paths $stagedPaths)
            $oversizedStagedPaths = @(Get-LargeGitObjectPaths -ObjectLines $stagedObjectLines)
            $oversizedGitPaths = @($oversizedStagedPaths | ForEach-Object { $_ -replace '（[0-9.]+ MiB）$', '' })
            if ($blockedPaths.Count -gt 0) {
                Write-Host '正在从暂存区排除依赖、运行数据、凭据和生成文件；本地文件会保留：' -ForegroundColor Yellow
                foreach ($path in $blockedPaths) {
                    Write-Host "  $path" -ForegroundColor DarkYellow
                }
            }

            if ($oversizedStagedPaths.Count -gt 0) {
                Write-Host '正在从暂存区排除超过 25 MiB 的文件；本地文件会保留，文件内容没有被读取或输出：' -ForegroundColor Yellow
                foreach ($path in $oversizedStagedPaths) {
                    Write-Host "  $path" -ForegroundColor DarkYellow
                }
            }

            $pathsToUnstage = @($blockedPaths + $oversizedGitPaths | Select-Object -Unique)
            if ($pathsToUnstage.Count -gt 0) {
                $unstageArguments = @('rm', '--cached', '--ignore-unmatch', '--force', '--') + $pathsToUnstage
                Invoke-GitChecked -GitArguments $unstageArguments
                Write-Host ("已从暂存区移除 {0} 项；本地文件仍保留在磁盘上。" -f $pathsToUnstage.Count) -ForegroundColor Yellow
            }

            $stagedPaths = @(Invoke-GitOutput -GitArguments @('diff', '--cached', '--name-only'))
            $blockedPaths = @(Get-BlockedGitPaths -Paths $stagedPaths)
            if ($blockedPaths.Count -gt 0) {
                throw ("暂存区仍包含本机运行数据或配置，已阻止提交：`n{0}" -f ($blockedPaths -join "`n"))
            }
            # 明确告知排除结果：依赖、构建产物、运行数据、数据库、凭据和 .env 都不会进入提交。
            Write-Host ("已校验 {0} 个待提交文件：不含 node_modules、dist 等依赖与构建产物，也不含运行数据、数据库、凭据和 .env。" -f $stagedPaths.Count) -ForegroundColor Green

            $oversizedStagedPaths = @(Get-LargeGitObjectPaths -ObjectLines (Get-GitIndexObjectLines -Paths $stagedPaths))
            if ($oversizedStagedPaths.Count -gt 0) {
                throw ("暂存区仍包含超过 25 MiB 的文件，已阻止提交：`n{0}" -f ($oversizedStagedPaths -join "`n"))
            }

            if ($stagedPaths.Count -gt 0) {
                $secretFindings = Get-GitSecretFindings -Scope 'Index' -Paths $stagedPaths
                Assert-GitSecretFindings -ScopeLabel '暂存源码' -Blocking $secretFindings.Blocking -Advisory $secretFindings.Advisory

                $stagedSummary = @(Invoke-GitOutput -GitArguments @('diff', '--cached', '--name-status', '--find-renames'))
                Write-Host ''
                Write-Host '本次待提交文件：' -ForegroundColor Cyan
                foreach ($path in $stagedSummary) {
                    Write-Host "  $path"
                }

                Write-Host ''
                Write-Host ("更新日志版本：{0}（来源：docs\updata-log.md）" -f $projectVersion.Label) -ForegroundColor Magenta
                # 只问一次提交说明：输入内容原样作为 commit message，不再额外询问版本、也不自动加前缀。
                Write-Host '本次提交信息：直接输入提交说明即可。' -ForegroundColor Cyan
                do {
                    $commitMessage = (Read-Host '【提交说明】【必填】').Trim()
                }
                while ([string]::IsNullOrWhiteSpace($commitMessage))

                Invoke-GitChecked -GitArguments @('commit', '-m', $commitMessage)
                $commitCreated = $true
            }
            else {
                Write-Host '过滤后没有可提交的源码变化，不创建空提交。' -ForegroundColor Yellow
            }
        }
        else {
            Write-Host '工作区没有新变化。' -ForegroundColor Green
        }

        if (-not $commitCreated) {
            # 没有任何代码改动时不做无意义推送：远端已含本地 HEAD 就直接结束。
            # 若本地还有没推上去的提交（例如上次推送失败），仍然继续推送，避免重试无路可走。
            $headRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', 'HEAD')) -join '').Trim()
            $remoteRevision = ''
            try {
                $remoteRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', '--verify', 'refs/remotes/origin/main')) -join '').Trim()
            }
            catch {
                $remoteRevision = ''
            }
            if ($remoteRevision -eq $headRevision) {
                Write-Host ''
                Write-Host '未检测到代码改动，远端 main 已与本地一致，无需推送。' -ForegroundColor Yellow
                return
            }
            Write-Host '未检测到代码改动，但本地有尚未推送的提交，将继续推送。' -ForegroundColor Yellow
        }

        [void](Invoke-GitOutput -GitArguments @('rev-parse', '--verify', 'HEAD'))

        $historyObjects = @(Invoke-GitOutput -GitArguments @('rev-list', '--objects', 'HEAD'))
        $historyPaths = @($historyObjects | ForEach-Object {
            $separator = $_.IndexOf(' ')
            if ($separator -ge 0 -and $separator -lt ($_.Length - 1)) {
                $_.Substring($separator + 1)
            }
        })
        $blockedHistoryPaths = @(Get-BlockedGitPaths -Paths $historyPaths)
        if ($blockedHistoryPaths.Count -gt 0) {
            throw ("本地 Git 历史含有运行数据、依赖或敏感文件路径；已阻止推送：`n{0}" -f ($blockedHistoryPaths -join "`n"))
        }

        $oversizedHistoryPaths = @(Get-LargeGitObjectPaths -ObjectLines $historyObjects)
        if ($oversizedHistoryPaths.Count -gt 0) {
            throw ("本地 Git 历史含有超过 25 MiB 的文件对象；已阻止推送：`n{0}" -f ($oversizedHistoryPaths -join "`n"))
        }

        $historySecrets = Get-GitSecretFindings -Scope 'History'
        Assert-GitSecretFindings -ScopeLabel '本地 Git 历史' -Blocking $historySecrets.Blocking -Advisory $historySecrets.Advisory

        Write-Host ''
        Write-Host 'HTTPS 传输低于 1 KiB/s 持续 60 秒时会超时退出。' -ForegroundColor DarkGray
        if ($isForcePush) {
            Write-Host '正在执行强制推送：git push --force origin HEAD:refs/heads/main ……' -ForegroundColor Yellow
            Invoke-GitChecked -GitArguments @('-c', 'http.lowSpeedLimit=1024', '-c', 'http.lowSpeedTime=60', 'push', '--force', 'origin', 'HEAD:refs/heads/main')
        }
        else {
            Write-Host '正在执行正常推送：git push origin HEAD:refs/heads/main ……' -ForegroundColor Green
            Invoke-GitChecked -GitArguments @('-c', 'http.lowSpeedLimit=1024', '-c', 'http.lowSpeedTime=60', 'push', 'origin', 'HEAD:refs/heads/main')
        }
        Write-Host ("GitHub main {0}成功，版本：{1}。" -f $pushModeLabel, $projectVersion.Label) -ForegroundColor Green
    }
    catch {
        if (-not $isForcePush -and $_.Exception.Message -match '(?i)non-fast-forward|fetch first|rejected') {
            Write-Host '常规推送被 Git 拒绝：远端包含本地没有的提交；远端历史没有被覆盖。' -ForegroundColor Yellow
        }
        Write-Host "GitHub 推送失败：$($_.Exception.Message)" -ForegroundColor Red
    }
}

while ($true) {
    Show-MainMenu
    $choice = [string](Read-Host '输入编号并按 Enter')
    # 重定向输入结束时正常退出，避免无输入反复刷新菜单。
    if ([Console]::IsInputRedirected -and [string]::IsNullOrWhiteSpace($choice)) { exit 0 }
    try {
        switch ($choice.Trim()) {
            '1' { Install-WorkspaceDependencies }
            '2' { Start-Harness }
            '3' { Invoke-WorkspacePnpm -Arguments @('run', 'build:win') }
            '4' { Show-EnvironmentStatus; Show-DependencyScope }
            '5' { Start-ProjectBackup }
            '6' { Push-GitHubRepository }
            '7' { Push-GitHubRepository -Force }
            '0' { Write-Host '已退出 LFAA Harness 工作台。' -ForegroundColor DarkGray; exit 0 }
            default { Write-Host '无效编号，请选择 0 至 7。' -ForegroundColor Red }
        }
    }
    catch {
        Write-Host "操作未完成：$($_.Exception.Message)" -ForegroundColor Red
    }
    Read-Host '按 Enter 返回菜单' | Out-Null
}
