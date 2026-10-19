<#
功能：安全地将当前 LFAA 源码工作区快进到 GitHub origin/main。
作用：先确认仓库、工作区和用户数据根，再 fetch；仅在可快进且不触碰数据根时更新源码。
关联文件：lfaa.bat、scripts/project-menu.mjs、scripts/install-dependencies.ps1、scripts/resolve-data-directory.mjs。
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = (Join-Path $PSScriptRoot '..'),
    [string]$Remote = 'origin',
    [string]$Branch = 'main',
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$projectPath = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd([char[]]@('\', '/'))
$gitCommonArguments = @('-c', 'core.quotePath=false', '-C', $projectPath)

function Invoke-GitOutput {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)
    $lines = @(& git @gitCommonArguments @GitArguments 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ("Git 命令失败（退出代码 {0}）：git {1}`n{2}" -f $exitCode, ($GitArguments -join ' '), ($lines -join "`n"))
    }
    return @($lines)
}

function Invoke-GitChecked {
    param([Parameter(Mandatory = $true)][string[]]$GitArguments)
    & git @gitCommonArguments @GitArguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ("Git 命令失败（退出代码 {0}）：git {1}" -f $exitCode, ($GitArguments -join ' '))
    }
}

function Get-RepositoryDataRelativePath {
    param([Parameter(Mandatory = $true)][string]$DataRoot)
    $root = [System.IO.Path]::GetFullPath($projectPath).TrimEnd([char[]]@('\', '/'))
    $data = [System.IO.Path]::GetFullPath($DataRoot).TrimEnd([char[]]@('\', '/'))
    $rootPrefix = $root + [System.IO.Path]::DirectorySeparatorChar
    $dataPrefix = $data + [System.IO.Path]::DirectorySeparatorChar

    if ($data.Equals($root, [System.StringComparison]::OrdinalIgnoreCase)) { return '.' }
    if ($root.StartsWith($dataPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        # 数据根包住源码根时，任何更新都落在数据根内，无法安全区分。
        return '.'
    }
    if ($data.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $data.Substring($rootPrefix.Length).Replace('\', '/')
    }
    return ''
}

if (-not (Get-Command 'git' -ErrorAction SilentlyContinue)) { throw '未检测到 Git，无法更新本地源码。' }
if (-not (Test-Path -LiteralPath (Join-Path $projectPath 'package.json') -PathType Leaf)) { throw "所选目录不是 LFAA 项目根目录：$projectPath" }

$gitRoot = ((Invoke-GitOutput -GitArguments @('rev-parse', '--show-toplevel')) -join "`n").Trim()
if ([System.IO.Path]::GetFullPath($gitRoot).TrimEnd([char[]]@('\', '/')) -ne $projectPath) {
    throw "Git 仓库根目录与所选项目目录不一致：$gitRoot"
}

$branchName = ((Invoke-GitOutput -GitArguments @('symbolic-ref', '--quiet', '--short', 'HEAD')) -join "`n").Trim()
if ([string]::IsNullOrWhiteSpace($branchName)) { throw '当前处于 detached HEAD；为避免移动错误分支，已停止更新。' }

$remoteNames = @(Invoke-GitOutput -GitArguments @('remote'))
if ($remoteNames -notcontains $Remote) { throw "找不到 Git 远端 $Remote；没有修改本地源码。" }

$worktreeChanges = @(Invoke-GitOutput -GitArguments @('status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'))
$gitDirectory = ((Invoke-GitOutput -GitArguments @('rev-parse', '--git-dir')) -join "`n").Trim()
if (-not [System.IO.Path]::IsPathRooted($gitDirectory)) { $gitDirectory = Join-Path $projectPath $gitDirectory }
foreach ($stateName in @('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply')) {
    if (Test-Path -LiteralPath (Join-Path $gitDirectory $stateName)) { throw "Git 正处于未完成的 $stateName 操作；没有更新源码。" }
}

$nodeCommand = Get-Command 'node' -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw '缺少 Node.js，无法用 LFAA 唯一 Owner 解析数据目录；为保护用户数据，没有更新源码。' }
$dataResolver = Join-Path $PSScriptRoot 'resolve-data-directory.mjs'
if (-not (Test-Path -LiteralPath $dataResolver -PathType Leaf)) { throw '缺少 scripts\resolve-data-directory.mjs；为保护用户数据，没有更新源码。' }
$dataLines = @(& $nodeCommand.Source $dataResolver $projectPath 2>&1 | ForEach-Object { [string]$_ })
$dataExitCode = $LASTEXITCODE
$dataRoot = ($dataLines -join "`n").Trim()
if ($dataExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($dataRoot) -or -not [System.IO.Path]::IsPathRooted($dataRoot)) {
    throw '无法解析当前 LFAA_DATA_DIR；为保护用户数据，没有更新源码。'
}
$dataRoot = [System.IO.Path]::GetFullPath($dataRoot)
$dataRootExisted = Test-Path -LiteralPath $dataRoot -PathType Container
$dataRelativePath = Get-RepositoryDataRelativePath -DataRoot $dataRoot
Write-Host "项目目录：$projectPath" -ForegroundColor DarkGray
Write-Host "当前分支：$branchName" -ForegroundColor DarkGray
Write-Host "用户数据目录：$dataRoot" -ForegroundColor DarkGray
Write-Host '更新目标：origin/main（只快进，不强制覆盖）' -ForegroundColor Cyan

Write-Host '正在读取 GitHub 最新提交……' -ForegroundColor Cyan
Invoke-GitChecked -GitArguments @('fetch', '--no-tags', $Remote, ("refs/heads/{0}:refs/remotes/{1}/{0}" -f $Branch, $Remote))
$remoteRef = "refs/remotes/$Remote/$Branch"
[void](Invoke-GitOutput -GitArguments @('rev-parse', '--verify', $remoteRef))
$headRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', 'HEAD')) -join '').Trim()
$remoteRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', $remoteRef)) -join '').Trim()

$targetBranchRef = "refs/heads/$Branch"
$targetBranchSyncState = 'not-needed'
$targetBranchRevision = ''
$targetBranchIncomingCount = 0
if ($branchName -eq $Branch) {
    $targetBranchSyncState = 'current-branch'
}
else {
    & git @gitCommonArguments show-ref --verify --quiet $targetBranchRef 2>$null
    $targetBranchLookupExitCode = $LASTEXITCODE
    if ($targetBranchLookupExitCode -eq 0) {
        $targetBranchRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', '--verify', $targetBranchRef)) -join '').Trim()
        if ($targetBranchRevision -eq $remoteRevision) {
            $targetBranchSyncState = 'up-to-date'
        }
        else {
            $worktreeRecords = @(Invoke-GitOutput -GitArguments @('worktree', 'list', '--porcelain'))
            if ($worktreeRecords -contains "branch $targetBranchRef") {
                $targetBranchSyncState = 'checked-out-elsewhere'
            }
            else {
                & git @gitCommonArguments merge-base --is-ancestor $targetBranchRef $remoteRef 2>$null
                if ($LASTEXITCODE -eq 0) {
                    $targetBranchSyncState = 'fast-forward'
                    $targetBranchIncomingCount = [int](((Invoke-GitOutput -GitArguments @('rev-list', '--count', ("{0}..{1}" -f $targetBranchRef, $remoteRef))) -join '').Trim())
                }
                else {
                    $targetBranchSyncState = 'preserve-local-history'
                }
            }
        }
    }
    elseif ($targetBranchLookupExitCode -eq 1) {
        $targetBranchSyncState = 'missing'
    }
    else {
        throw ("无法检查本地分支 {0}；没有移动任何分支引用。" -f $Branch)
    }
}

$needsCurrentUpdate = $headRevision -ne $remoteRevision
if ($needsCurrentUpdate -and -not [string]::IsNullOrWhiteSpace($dataRelativePath)) {
    $dataChanges = @(Invoke-GitOutput -GitArguments (@('diff', '--name-only', 'HEAD', $remoteRef, '--', $dataRelativePath)))
    if ($dataChanges.Count -gt 0) {
        Write-Host '远端提交触及当前用户数据目录；为保护本地数据，已停止更新：' -ForegroundColor Red
        $dataChanges | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        throw '请先核实数据目录与远端源码路径后再更新。'
    }
}

if ($needsCurrentUpdate) {
    & git @gitCommonArguments merge-base --is-ancestor HEAD $remoteRef 2>$null
    $localIsAncestor = $LASTEXITCODE -eq 0
    if (-not $localIsAncestor) {
        & git @gitCommonArguments merge-base --is-ancestor $remoteRef HEAD 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host '本地分支含有 GitHub 尚未包含的提交；为保留本地历史，没有移动分支。' -ForegroundColor Yellow
            return
        }
        throw '本地与 GitHub main 已分叉；快进更新不适用，没有合并或覆盖任何提交。请先单独核对两个分支。'
    }
}

$currentIncomingCount = 0
$changeSummary = @()
if ($needsCurrentUpdate) {
    $currentIncomingCount = [int](((Invoke-GitOutput -GitArguments @('rev-list', '--count', ("HEAD..{0}" -f $remoteRef))) -join '').Trim())
    $changeSummary = @(Invoke-GitOutput -GitArguments @('diff', '--name-status', 'HEAD', $remoteRef, '--'))
    Write-Host ("当前分支有 {0} 个 GitHub 新提交，文件变化如下：" -f $currentIncomingCount) -ForegroundColor Cyan
    $changeSummary | Select-Object -First 40 | ForEach-Object { Write-Host "  $_" }
    if ($changeSummary.Count -gt 40) { Write-Host ("  ……还有 {0} 项" -f ($changeSummary.Count - 40)) -ForegroundColor DarkGray }
}
else {
    Write-Host '当前工作分支已经与 GitHub main 一致。' -ForegroundColor Green
}

if ($targetBranchSyncState -eq 'fast-forward') {
    Write-Host ("本地 {0} 分支另有 {1} 个可安全快进提交；确认后将一并更新该分支引用。" -f $Branch, $targetBranchIncomingCount) -ForegroundColor Cyan
}
elseif ($targetBranchSyncState -eq 'checked-out-elsewhere') {
    Write-Host ("本地 {0} 正在其他工作区检出；为避免只移动分支指针，保留该工作区不动。" -f $Branch) -ForegroundColor Yellow
}
elseif ($targetBranchSyncState -eq 'preserve-local-history') {
    Write-Host ("本地 {0} 含有 GitHub main 未包含的历史；为保留本地提交，不移动该分支引用。" -f $Branch) -ForegroundColor Yellow
}
elseif ($targetBranchSyncState -eq 'missing') {
    Write-Host ("本地尚未创建 {0} 分支；不会自动创建分支。" -f $Branch) -ForegroundColor DarkGray
}

$willUpdateTargetBranch = $targetBranchSyncState -eq 'fast-forward'
if (-not $needsCurrentUpdate -and -not $willUpdateTargetBranch) {
    if ($worktreeChanges.Count -gt 0) {
        Write-Host '没有可安全应用的本地更新；未提交的源码变化已保留。' -ForegroundColor Green
        return
    }
    Write-Host '没有可安全应用的本地更新。' -ForegroundColor Green
    return
}

if ($worktreeChanges.Count -gt 0) {
    Write-Host '工作区存在尚未提交的源码变化；为保护它们，本次不会执行快进合并：' -ForegroundColor Yellow
    $worktreeChanges | Select-Object -First 40 | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    if ($worktreeChanges.Count -gt 40) { Write-Host ("  ……还有 {0} 项" -f ($worktreeChanges.Count - 40)) -ForegroundColor Yellow }
    throw '已检查远端，但因当前确有待应用更新而停止。请先备份或提交本地改动后重试；无需推送到 GitHub。'
}

Write-Host '更新只执行快进；不会 reset、clean、强制覆盖或删除本地数据。' -ForegroundColor Green

if (-not $Yes) {
    $updateTargets = @()
    if ($needsCurrentUpdate) { $updateTargets += "当前分支 $branchName" }
    if ($willUpdateTargetBranch) { $updateTargets += "本地分支 $Branch" }
    $answer = (Read-Host ("确认将 {0} 快进到 {1}/{2}？输入 y 继续，其他输入取消" -f ($updateTargets -join ' 和 '), $Remote, $Branch)).Trim()
    if ($answer -notmatch '^(y|yes|是)$') { Write-Host '已取消更新；fetch 只刷新了远端提交记录，本地源码未改变。' -ForegroundColor DarkGray; return }
}

if ($needsCurrentUpdate) {
    Invoke-GitChecked -GitArguments @('merge', '--ff-only', '--no-edit', $remoteRef)
}
$updatedRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', 'HEAD')) -join '').Trim()
if ($updatedRevision -ne $remoteRevision) { throw '更新后 HEAD 与已核验的 origin/main 不一致；请检查仓库状态。' }

if ($willUpdateTargetBranch) {
    $worktreeRecords = @(Invoke-GitOutput -GitArguments @('worktree', 'list', '--porcelain'))
    if ($worktreeRecords -contains "branch $targetBranchRef") {
        $targetBranchSyncState = 'checked-out-elsewhere'
        Write-Host ("本地 {0} 刚在其他工作区检出；为避免影响其工作文件，跳过该分支引用更新。" -f $Branch) -ForegroundColor Yellow
    }
    else {
        Invoke-GitChecked -GitArguments @('update-ref', $targetBranchRef, $remoteRevision, $targetBranchRevision)
        $targetBranchRevision = ((Invoke-GitOutput -GitArguments @('rev-parse', '--verify', $targetBranchRef)) -join '').Trim()
        if ($targetBranchRevision -ne $remoteRevision) { throw ("本地 {0} 分支未能与已核验的远端提交对齐。" -f $Branch) }
        $targetBranchSyncState = 'updated'
    }
}

if ($dataRootExisted -and -not (Test-Path -LiteralPath $dataRoot -PathType Container)) {
    throw '更新后检测到原用户数据目录不可见；请停止启动服务并立即检查磁盘/路径，本脚本未运行清理或重置命令。'
}
$finalChanges = @(Invoke-GitOutput -GitArguments @('status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'))
if ($finalChanges.Count -gt 0) { throw '源码已快进，但更新后工作区未保持干净；未执行任何自动清理，请检查上面列出的本地变化。' }
Write-Host ("当前工作分支已核对到 {0}；用户数据目录仍为 {1}。" -f $updatedRevision.Substring(0, [Math]::Min(12, $updatedRevision.Length)), $dataRoot) -ForegroundColor Green
if ($targetBranchSyncState -eq 'updated') {
    Write-Host ("本地 {0} 分支也已安全快进到同一提交。" -f $Branch) -ForegroundColor Green
}
