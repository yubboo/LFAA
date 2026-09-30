<#
功能：启动 LFAA 前端、server 和本机 daemon 的开发进程。
作用：检查运行环境、已安装依赖和服务端口，并在当前窗口并行运行三项服务，或运行指定的单个服务。
关联文件：根目录 package.json、scripts/install-dependencies.ps1、scripts/resolve-data-directory.mjs、scripts/apply-data-directory-migration.mjs、apps/web/package.json、apps/cli/package.json、apps/daemon/package.json。
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
$script:InitialLfaaDataDirectory = [string]$env:LFAA_DATA_DIR
$script:InitialLfaaDataDirectoryManagedByLauncher = $env:LFAA_DATA_DIR_MANAGED_BY_LAUNCHER -eq '1'

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
        'frontend' { Join-Path $projectRoot 'apps/web/node_modules/vite/package.json' }
        'server' { Join-Path $projectRoot 'apps/cli/node_modules/tsx/package.json' }
        'daemon' { Join-Path $projectRoot 'packages/host/daemon/src/daemon.mjs' }
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

function Get-ConfiguredServerPort {
    $configuredPort = [string]$env:SERVER_PORT
    if (-not $configuredPort) {
        $environmentFile = Join-Path $projectRoot '.env'
        if (Test-Path -LiteralPath $environmentFile) {
            foreach ($line in Get-Content -LiteralPath $environmentFile -Encoding UTF8) {
                if ($line -match '^\s*SERVER_PORT\s*=\s*([^#]+)') {
                    $configuredPort = $Matches[1].Trim().Trim('"').Trim("'")
                    break
                }
            }
        }
    }

    if (-not $configuredPort) { return 3000 }
    if ($configuredPort -notmatch '^\d+$' -or [int]$configuredPort -lt 1 -or [int]$configuredPort -gt 65535) {
        throw 'SERVER_PORT 必须是 1–65535 之间的端口号。'
    }
    return [int]$configuredPort
}

function Initialize-LfaaDataDirectory {
    $configuredDataDirectory = ''
    $launcherManagesDataDirectory = $true
    if ($script:InitialLfaaDataDirectory -and -not $script:InitialLfaaDataDirectoryManagedByLauncher) {
        $configuredDataDirectory = $script:InitialLfaaDataDirectory
        $launcherManagesDataDirectory = $false
    }
    else {
        $environmentFile = Join-Path $projectRoot '.env'
        if (Test-Path -LiteralPath $environmentFile) {
            foreach ($line in Get-Content -LiteralPath $environmentFile -Encoding UTF8) {
                if ($line -match '^\s*(?:export\s+)?LFAA_DATA_DIR\s*=\s*"([^"]*)"\s*(?:#.*)?$') {
                    $configuredDataDirectory = $Matches[1].Trim()
                    break
                }
                if ($line -match "^\s*(?:export\s+)?LFAA_DATA_DIR\s*=\s*'([^']*)'\s*(?:#.*)?`$") {
                    $configuredDataDirectory = $Matches[1].Trim()
                    break
                }
                if ($line -match '^\s*(?:export\s+)?LFAA_DATA_DIR\s*=\s*([^#]+?)\s*(?:#.*)?$') {
                    $configuredDataDirectory = $Matches[1].Trim()
                    break
                }
            }
        }
    }
    if (-not $configuredDataDirectory) { $configuredDataDirectory = 'data' }

    $nodeCommand = Get-Command 'node' -ErrorAction Stop
    $resolverPath = Join-Path $projectRoot 'scripts/resolve-data-directory.mjs'
    $resolverOutput = @(& $nodeCommand.Source $resolverPath $projectRoot $configuredDataDirectory 2>&1)
    $resolverExitCode = $LASTEXITCODE
    if ($resolverExitCode -ne 0 -or $resolverOutput.Count -eq 0) {
        $details = ($resolverOutput | ForEach-Object { [string]$_ }) -join ' '
        throw "无法解析本机 LFAA 数据目录。$details"
    }

    $resolvedDataDirectory = ([string]($resolverOutput | Select-Object -Last 1)).Trim()
    if (-not $resolvedDataDirectory) { throw '数据目录解析器未返回有效路径。' }
    $env:LFAA_DATA_DIR = $resolvedDataDirectory
    $env:LFAA_DATA_DIR_MANAGED_BY_LAUNCHER = if ($launcherManagesDataDirectory) { '1' } else { '0' }
    $env:LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED = if ($Mode -eq 'Launch' -and $launcherManagesDataDirectory) { '1' } else { '0' }
    Write-Host "本机运行数据目录：$resolvedDataDirectory" -ForegroundColor DarkGray
}

function Complete-LfaaDataDirectoryMigration {
    $requestPath = Join-Path $projectRoot '.lfaa-data-directory.pending.json'
    if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) { return }
    if ($Mode -eq 'Service') {
        throw '检测到待迁移的数据目录。请停止各个 LFAA 服务窗口，并通过项目启动器完整启动，以便安全复制共享数据。'
    }

    $nodeCommand = Get-Command 'node' -ErrorAction Stop
    $migrationScript = Join-Path $projectRoot 'scripts/apply-data-directory-migration.mjs'
    Write-Host '正在复制并核对 LFAA 本机数据目录；源目录会保留作回退。' -ForegroundColor Cyan
    & $nodeCommand.Source $migrationScript $projectRoot
    if ($LASTEXITCODE -ne 0) {
        Write-Host '数据目录迁移没有完成；将继续使用当前目录启动，原数据仍可在设置中心管理迁移请求。' -ForegroundColor Yellow
    }
}

function Get-ListeningProcessIds {
    param([Parameter(Mandatory = $true)][int]$Port)

    $tcpCommand = Get-Command 'Get-NetTCPConnection' -ErrorAction SilentlyContinue
    if ($tcpCommand) {
        try {
            $processIds = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
            if ($processIds.Count -gt 0) { return $processIds }
        }
        catch {
            # 某些 Windows 环境未加载 NetTCPIP 模块，下面改用 netstat 查询监听 PID。
        }
    }

    $netstatCommand = Get-Command 'netstat.exe' -ErrorAction SilentlyContinue
    if ($netstatCommand) {
        $portPattern = '^[\s]*TCP\s+\S+:' + [regex]::Escape([string]$Port) + '\s+\S+\s+LISTENING\s+(\d+)\s*$'
        $processIds = @(& $netstatCommand.Source -ano -p tcp | ForEach-Object {
            if ($_ -match $portPattern) { [int]$Matches[1] }
        } | Select-Object -Unique)
        return $processIds
    }

    return @()
}

function Assert-DevelopmentPortsAvailable {
    $portDescriptions = @{}
    if ($Mode -eq 'Service') {
        if ($Service -eq 'frontend') {
            $portDescriptions[5173] = 'Vite 前端'
        }
        elseif ($Service -eq 'server') {
            $portDescriptions[(Get-ConfiguredServerPort)] = 'LFAA 控制端'
        }
    }
    else {
        $serverPort = Get-ConfiguredServerPort
        if ($serverPort -eq 5173) {
            throw 'SERVER_PORT 不能与 Vite 前端共用 5173；请为控制端配置其他端口。'
        }
        $portDescriptions[5173] = 'Vite 前端'
        $portDescriptions[$serverPort] = 'LFAA 控制端'
    }

    $blockedPorts = @()
    foreach ($port in $portDescriptions.Keys) {
        $processIds = @(Get-ListeningProcessIds -Port ([int]$port))
        foreach ($processId in $processIds) {
            $processInfo = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
            $processName = if ($processInfo) { $processInfo.Name } else { '未知进程' }
            Write-Host "端口 $port（$($portDescriptions[$port])）已被占用：$processName，PID $processId。" -ForegroundColor Yellow
            $blockedPorts += [int]$port
        }
    }

    if ($blockedPorts.Count -gt 0) {
        $portList = ($blockedPorts | Sort-Object -Unique) -join '、'
        throw "启动前清理后，端口 $portList 仍被占用。本脚本只会停止确认属于当前 LFAA 项目的旧服务；若端口由其他程序占用，请先停止该程序。"
    }
}

function Get-ManagedDevelopmentProcesses {
    $normalizedRoot = $projectRoot.Replace('/', '\').TrimEnd('\').ToLowerInvariant()
    $serverPath = (Join-Path $projectRoot 'apps/cli').Replace('/', '\').ToLowerInvariant()
    $processes = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)
    $managedProcesses = @{}

    foreach ($processInfo in $processes) {
        if (-not $processInfo.CommandLine) { continue }
        $commandLine = ([string]$processInfo.CommandLine).Replace('/', '\').ToLowerInvariant()

        $isFrontend = $commandLine.Contains($normalizedRoot) -and
            $commandLine.Contains('\apps\web\') -and
            $commandLine.Contains('\vite\bin\vite.js')
        $isServerWatcher = $commandLine.Contains($serverPath) -and
            $commandLine.Contains('\tsx\dist\cli.mjs') -and
            $commandLine.Contains('watch') -and
            $commandLine.Contains('src\index.ts')
        $isServerRuntime = $commandLine.Contains($normalizedRoot) -and
            $commandLine.Contains('\tsx\dist\preflight.cjs') -and
            $commandLine.Contains('src\index.ts')

        if ($isFrontend -or $isServerWatcher -or $isServerRuntime) {
            $managedProcesses[[int]$processInfo.ProcessId] = $processInfo
        }
    }

    # Daemon 命令行使用相对入口；同时检查迁移请求记录的旧目录锁文件。
    $configuredDataDirectory = [string]$env:LFAA_DATA_DIR
    if (-not $configuredDataDirectory) {
        $environmentFile = Join-Path $projectRoot '.env'
        if (Test-Path -LiteralPath $environmentFile) {
            foreach ($line in Get-Content -LiteralPath $environmentFile -Encoding UTF8) {
                if ($line -match '^\s*LFAA_DATA_DIR\s*=\s*([^#]+)') {
                    $configuredDataDirectory = $Matches[1].Trim().Trim('"').Trim("'")
                    break
                }
            }
        }
    }
    if (-not $configuredDataDirectory) { $configuredDataDirectory = 'data' }
    if ([System.IO.Path]::IsPathRooted($configuredDataDirectory)) {
        $dataDirectory = [System.IO.Path]::GetFullPath($configuredDataDirectory)
    }
    else {
        $dataDirectory = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $configuredDataDirectory))
    }
    $daemonDataDirectories = @($dataDirectory)
    $pendingMigrationPath = Join-Path $projectRoot '.lfaa-data-directory.pending.json'
    if (Test-Path -LiteralPath $pendingMigrationPath -PathType Leaf) {
        try {
            $pendingMigration = Get-Content -LiteralPath $pendingMigrationPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($pendingMigration.sourceDirectory -and [System.IO.Path]::IsPathRooted([string]$pendingMigration.sourceDirectory)) {
                $daemonDataDirectories += [System.IO.Path]::GetFullPath([string]$pendingMigration.sourceDirectory)
            }
        }
        catch {
            throw '待迁移的数据目录标记无效；为避免遗留 Daemon 未停止，本次没有启动服务。'
        }
    }
    foreach ($daemonDataDirectory in @($daemonDataDirectories | Select-Object -Unique)) {
        $daemonLockPath = Join-Path $daemonDataDirectory 'credentials/daemon.lock'
        if (-not (Test-Path -LiteralPath $daemonLockPath -PathType Leaf)) { continue }
        $lockContents = Get-Content -LiteralPath $daemonLockPath -Raw -ErrorAction SilentlyContinue
        $lockPid = 0
        if ($lockContents -match '^\s*(\d+)\s*\r?\n') { $lockPid = [int]$Matches[1] }
        if ($lockPid -gt 0 -and -not $managedProcesses.ContainsKey($lockPid)) {
            $daemonProcess = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $lockPid" -ErrorAction SilentlyContinue
            if ($daemonProcess -and $daemonProcess.Name -ieq 'node.exe' -and $daemonProcess.CommandLine -match '(daemon\.mjs|--profile[ =]+daemon|apps[\\/]daemon[\\/]src[\\/]index\.mjs)') {
                $managedProcesses[$lockPid] = $daemonProcess
            }
        }
    }

    return [PSCustomObject]@{
        Processes = $processes
        Managed = $managedProcesses
    }
}

function Stop-PreviousDevelopmentServices {
    $managedState = Get-ManagedDevelopmentProcesses
    $managedProcesses = $managedState.Managed
    $processMap = @{}
    foreach ($processInfo in $managedState.Processes) {
        $processMap[[int]$processInfo.ProcessId] = $processInfo
    }

    $ports = @(5173)
    $serverPort = Get-ConfiguredServerPort
    if ($ports -notcontains $serverPort) { $ports += $serverPort }
    $unknownOwners = @()
    foreach ($port in $ports) {
        foreach ($processId in @(Get-ListeningProcessIds -Port ([int]$port))) {
            if (-not $managedProcesses.ContainsKey([int]$processId)) {
                $processInfo = $processMap[[int]$processId]
                $processName = if ($processInfo) { $processInfo.Name } else { '未知进程' }
                $unknownOwners += "端口 $port：$processName，PID $processId"
            }
        }
    }

    if ($unknownOwners.Count -gt 0) {
        throw "以下端口由非本项目进程占用，未结束任何进程：$($unknownOwners -join '；')。请先停止这些程序，再启动 LFAA。"
    }

    if ($managedProcesses.Count -eq 0) {
        Write-Host '未发现本项目遗留的前端、server 或 Daemon 进程。' -ForegroundColor DarkGray
        return
    }

    # 只从已识别的服务进程树顶端结束进程；不触碰 PowerShell、终端或其他应用。
    $serviceRoots = @()
    foreach ($processInfo in $managedProcesses.Values) {
        $parentId = [int]$processInfo.ParentProcessId
        $hasManagedAncestor = $false
        while ($parentId -gt 0 -and $processMap.ContainsKey($parentId)) {
            if ($managedProcesses.ContainsKey($parentId)) {
                $hasManagedAncestor = $true
                break
            }
            $parentId = [int]$processMap[$parentId].ParentProcessId
        }
        if (-not $hasManagedAncestor) { $serviceRoots += $processInfo }
    }

    $taskkillCommand = Get-Command 'taskkill.exe' -ErrorAction SilentlyContinue
    if (-not $taskkillCommand) { throw '找不到 taskkill.exe，无法安全停止已识别的旧服务。' }

    foreach ($processInfo in $serviceRoots) {
        Write-Host "正在停止本项目旧服务：$($processInfo.Name)，PID $($processInfo.ProcessId)" -ForegroundColor Yellow
        $isDaemon = $processInfo.CommandLine -match '(daemon\.mjs|--profile[ =]+daemon|apps[\\/]daemon[\\/]src[\\/]index\.mjs)'
        if ($isDaemon) {
            # Daemon 直接结束自身，不递归结束子进程，避免误杀仍在运行的 Minecraft Java 实例。
            $stopCommand = Start-Process -FilePath $taskkillCommand.Source -ArgumentList @('/PID', [string]$processInfo.ProcessId, '/F') -Wait -PassThru -NoNewWindow
        }
        else {
            $stopCommand = Start-Process -FilePath $taskkillCommand.Source -ArgumentList @('/PID', [string]$processInfo.ProcessId, '/T', '/F') -Wait -PassThru -NoNewWindow
        }
        $stillRunning = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($processInfo.ProcessId)" -ErrorAction SilentlyContinue
        if ($stillRunning) {
            throw "无法停止已识别的 LFAA 服务 PID $($processInfo.ProcessId)，taskkill 退出代码 $($stopCommand.ExitCode)。"
        }
    }

    $deadline = (Get-Date).AddSeconds(8)
    do {
        $remainingOwners = @()
        foreach ($port in $ports) {
            $remainingOwners += @(Get-ListeningProcessIds -Port ([int]$port))
        }
        $remainingOwners = @($remainingOwners | Select-Object -Unique)
        if ($remainingOwners.Count -eq 0) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    if ($remainingOwners.Count -gt 0) {
        throw "停止旧服务后端口仍被占用（PID $($remainingOwners -join '、')），为避免结束其他进程，本次不继续启动。"
    }
    Write-Host '旧 LFAA 服务已停止，准备启动新进程。' -ForegroundColor Green
}

function Invoke-DevelopmentScript {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('dev:services', 'dev:server', 'dev:frontend', 'dev:daemon')]
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
        if (Test-Path -LiteralPath (Join-Path $projectRoot '.lfaa-data-directory.pending.json') -PathType Leaf) {
            throw '检测到待迁移的数据目录；请通过项目启动器完整重启全部服务后再单独启动某个服务。'
        }
        if ($Service -in @('server', 'daemon')) { Initialize-LfaaDataDirectory }
        Assert-DevelopmentPortsAvailable
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
    if ((Get-ConfiguredServerPort) -eq 5173) {
        throw 'SERVER_PORT 不能与 Vite 前端共用 5173；请为控制端配置其他端口。'
    }
    Initialize-LfaaDataDirectory
    Stop-PreviousDevelopmentServices
    Complete-LfaaDataDirectoryMigration
    Initialize-LfaaDataDirectory
    Assert-DevelopmentPortsAvailable
}
catch {
    Write-Host "启动检查未通过：$($_.Exception.Message)" -ForegroundColor Red
    return
}

Write-Host '前端、server 和本机 Daemon 将在当前窗口中同时启动；按 Ctrl+C 停止三个服务。' -ForegroundColor Cyan
Invoke-DevelopmentScript -ScriptName 'dev:services' -StartupContext $startupContext

if ($script:ServiceExitCode -ne 0) {
    Write-Host "开发服务已退出，退出代码：$script:ServiceExitCode" -ForegroundColor Red
}
else {
    Write-Host '前端、server 和本机 Daemon 已停止。' -ForegroundColor Yellow
}
