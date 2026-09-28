<#
功能：显示 LFAA 项目主菜单并按用户选择执行操作。
作用：管理工作区依赖、启动开发服务、检查环境、备份项目源码或推送 GitHub。
关联文件：根目录 lfaa.bat、根目录 .gitignore、scripts/backup-project.ps1、scripts/start-dev.ps1、根目录 package.json、pnpm-workspace.yaml。
#>

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$rootManifest = Join-Path $projectRoot 'package.json'
$workspaceFile = Join-Path $projectRoot 'pnpm-workspace.yaml'

function Show-MainMenu {
    Clear-Host
    Write-Host ''
    Write-Host '╔══════════════════════════════════════════════╗' -ForegroundColor DarkCyan
    Write-Host '║               LFAA 项目管理工作台            ║' -ForegroundColor Cyan
    Write-Host '╚══════════════════════════════════════════════╝' -ForegroundColor DarkCyan
    Write-Host ''
    Write-Host '请选择要执行的操作：' -ForegroundColor White
    Write-Host '  【1】一键安装全部项目依赖' -ForegroundColor Green
    Write-Host '  【2】一键启动前端、server 和本机 Daemon' -ForegroundColor Magenta
    Write-Host '  【3】查看依赖安装范围' -ForegroundColor Cyan
    Write-Host '  【4】检查 Node.js、pnpm、Rust 和工作区环境' -ForegroundColor Yellow
    Write-Host '  【5】一键生成版本化源码 ZIP' -ForegroundColor Green
    Write-Host '  【6】一键强制推送 GitHub main（覆盖远端历史）' -ForegroundColor Red
    Write-Host '  【0】退出' -ForegroundColor Red
    Write-Host ''
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
        Write-Host "  项目指定 pnpm：$expectedVersion" -ForegroundColor Cyan
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

    $packageDirectories = @('frontend', 'server', 'daemon')
    foreach ($directory in $packageDirectories) {
        $manifestPath = Join-Path $projectRoot (Join-Path $directory 'package.json')
        if (Test-Path -LiteralPath $manifestPath) {
            $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
            Write-Host "  【Node.js】$directory（$($manifest.name)）" -ForegroundColor Green
        }
    }

    $appsPath = Join-Path $projectRoot 'apps'
    if (Test-Path -LiteralPath $appsPath) {
        $appDirectories = @(Get-ChildItem -LiteralPath $appsPath -Directory)
        $appManifests = @()
        foreach ($appDirectory in $appDirectories) {
            $manifestPath = Join-Path $appDirectory.FullName 'package.json'
            if (Test-Path -LiteralPath $manifestPath) {
                $appManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
                $appManifests += [PSCustomObject]@{ Directory = $appDirectory.Name; Name = $appManifest.name }
            }
        }
        foreach ($appManifest in $appManifests) {
            Write-Host "  【Node.js】$($appManifest.Directory)（$($appManifest.Name)）" -ForegroundColor Green
        }
        if ($appManifests.Count -eq 0) {
            Write-Host '  【桌面端】apps/* 目前没有 package.json；加入后会自动纳入工作区。' -ForegroundColor Yellow
        }
    }

    Write-Host '  【不由 pnpm 管理】Daemon Windows AppContainer Sandbox Host 与 Tauri Rust/Cargo 依赖，需使用 Rust 工具链。' -ForegroundColor DarkYellow
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
        Write-Host "项目备份失败：$($_.Exception.Message)" -ForegroundColor Red
    }
}

function Install-WorkspaceDependencies {
    if (-not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
        Write-Host '未检测到 Node.js，请先安装 Node.js。' -ForegroundColor Red
        return
    }

    if (-not (Test-Path -LiteralPath $workspaceFile)) {
        Write-Host '未找到 pnpm-workspace.yaml，无法安装工作区依赖。' -ForegroundColor Red
        return
    }

    $manifest = Get-ProjectManifest
    $packageManagerSpec = [string]$manifest.packageManager
    if ($packageManagerSpec -notmatch '^pnpm@(.+)$') {
        Write-Host '根目录 package.json 未指定有效的 pnpm 版本。' -ForegroundColor Red
        return
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
            Write-Host "当前 pnpm 与项目要求的 $expectedPnpmVersion 不一致，且未检测到 Corepack。" -ForegroundColor Red
            return
        }
    }
    elseif ($corepackCommand) {
        $useCorepack = $true
    }
    else {
        Write-Host '未检测到 pnpm 或 Corepack，请先安装项目指定的 pnpm。' -ForegroundColor Red
        return
    }

    Set-Location -LiteralPath $projectRoot
    Write-Host '开始安装所有已加入工作区的 Node.js 依赖……' -ForegroundColor Cyan

    if ($useCorepack) {
        Write-Host "由 Corepack 获取并运行 pnpm $expectedPnpmVersion。" -ForegroundColor Yellow
        & $corepackCommand.Source pnpm install
    }
    else {
        & $pnpmCommand.Source install
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "pnpm 安装失败，退出代码：$LASTEXITCODE" -ForegroundColor Red
        return
    }

    Write-Host 'pnpm 工作区依赖安装成功，锁文件已写入根目录。' -ForegroundColor Green
}

function Invoke-GitOutput {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)

    $lines = @(& git -C $projectRoot @GitArguments 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ("Git 命令失败（退出代码 {0}）：git {1}`n{2}" -f $exitCode, ($GitArguments -join ' '), ($lines -join "`n"))
    }

    return $lines
}

function Invoke-GitChecked {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)

    & git -C $projectRoot @GitArguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ("Git 命令失败（退出代码 {0}）：git {1}" -f $exitCode, ($GitArguments -join ' '))
    }
}

function Get-GitConfigValue {
    param([Parameter(Mandatory = $true)][string]$Key)

    $lines = @(& git -C $projectRoot config --get $Key 2>$null | ForEach-Object { [string]$_ })
    if ($LASTEXITCODE -ne 0) {
        return ''
    }

    return ($lines -join "`n").Trim()
}

function Get-BlockedGitPaths {
    param([string[]]$Paths)

    return @($Paths | Where-Object {
        $path = $_ -replace '\\', '/'
        $path -match '(?i)(^|/)(data|dist|node_modules)(/|$)' -or
        (($path -match '(^|/)\.env($|\.)') -and ($path -notmatch '(^|/)\.env\.example$')) -or
        $path -match '(?i)\.(sqlite|sqlite3|db)(-(wal|shm))?$' -or
        $path -match '(?i)\.log$'
    })
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

function Push-GitHubRepository {
    Write-Host ''
    Write-Host '【GitHub 强制推送】' -ForegroundColor Red
    Write-Host '目标：https://github.com/yubboo/LFAA.git' -ForegroundColor Cyan
    Write-Host '分支：main' -ForegroundColor Cyan
    Write-Host '强制推送会用本地当前提交覆盖 GitHub main 的提交历史。' -ForegroundColor Yellow

    if (-not (Get-Command 'git' -ErrorAction SilentlyContinue)) {
        Write-Host '未检测到 Git for Windows，请先安装 Git 并加入 PATH。' -ForegroundColor Red
        return
    }

    try {
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

        $workingChanges = @(Invoke-GitOutput -GitArguments @('status', '--short', '--untracked-files=all'))
        if ($workingChanges.Count -gt 0) {
            Write-Host ''
            Write-Host '检测到以下工作区变化：' -ForegroundColor Cyan
            foreach ($change in $workingChanges) {
                Write-Host "  $change"
            }

            Invoke-GitChecked -GitArguments @('add', '-A')

            # 运行时数据和凭据即使误入暂存区，也必须在提交前拦截。
            $stagedPaths = @(Invoke-GitOutput -GitArguments @('diff', '--cached', '--name-only'))
            $blockedPaths = @(Get-BlockedGitPaths -Paths $stagedPaths)
            if ($blockedPaths.Count -gt 0) {
                Write-Host '正在从暂存区排除本机运行数据、配置和日志；本地文件会保留：' -ForegroundColor Yellow
                foreach ($path in $blockedPaths) {
                    Write-Host "  $path" -ForegroundColor DarkYellow
                }

                $unstageArguments = @('rm', '--cached', '--ignore-unmatch', '--force', '--') + $blockedPaths
                Invoke-GitChecked -GitArguments $unstageArguments

                $stagedPaths = @(Invoke-GitOutput -GitArguments @('diff', '--cached', '--name-only'))
                $blockedPaths = @(Get-BlockedGitPaths -Paths $stagedPaths)
                if ($blockedPaths.Count -gt 0) {
                    throw ("暂存区仍包含本机运行数据或配置，已阻止提交：`n{0}" -f ($blockedPaths -join "`n"))
                }
            }

            $stagedSummary = @(Invoke-GitOutput -GitArguments @('diff', '--cached', '--name-status', '--find-renames'))
            Write-Host ''
            Write-Host '本次待提交文件：' -ForegroundColor Cyan
            foreach ($path in $stagedSummary) {
                Write-Host "  $path"
            }

            Write-Host '接下来请输入提交说明；提交完成后会继续强制推送。' -ForegroundColor Cyan
            do {
                $commitMessage = (Read-Host '【提交说明】【必填】').Trim()
            }
            while ([string]::IsNullOrWhiteSpace($commitMessage))

            Invoke-GitChecked -GitArguments @('commit', '-m', $commitMessage)
        }
        else {
            Write-Host '工作区没有新变化，将推送当前本地提交。' -ForegroundColor Green
        }

        [void](Invoke-GitOutput -GitArguments @('rev-parse', '--verify', 'HEAD'))

        Write-Host ''
        Write-Host '正在执行 git push --force origin HEAD:refs/heads/main ……' -ForegroundColor Yellow
        # 按用户要求覆盖远端 main，不先合并远端历史。
        Invoke-GitChecked -GitArguments @('push', '--force', 'origin', 'HEAD:refs/heads/main')
        Write-Host 'GitHub main 强制推送成功。' -ForegroundColor Green
    }
    catch {
        Write-Host "GitHub 推送失败：$($_.Exception.Message)" -ForegroundColor Red
    }
}

while ($true) {
    Show-MainMenu
    $choice = (Read-Host '输入编号并按 Enter').Trim()

    switch ($choice) {
        '1' { Install-WorkspaceDependencies; Read-Host '按 Enter 返回菜单' | Out-Null }
        '2' { Start-DevelopmentServices; Read-Host '按 Enter 返回菜单' | Out-Null }
        '3' { Show-DependencyScope; Read-Host '按 Enter 返回菜单' | Out-Null }
        '4' { Show-EnvironmentStatus; Read-Host '按 Enter 返回菜单' | Out-Null }
        '5' { Start-ProjectBackup; Read-Host '按 Enter 返回菜单' | Out-Null }
        '6' { Push-GitHubRepository; Read-Host '按 Enter 返回菜单' | Out-Null }
        '0' { Write-Host '已退出 LFAA 项目管理工作台。' -ForegroundColor DarkGray; exit 0 }
        default { Write-Host '无效编号，请选择 0 至 6。' -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
}
