$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 中文输出。
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
try { & chcp.com 65001 | Out-Null } catch {}

$DefaultBranch = "main"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$ParentRoot = Split-Path -Parent $PackageRoot
$SiblingStableWorkspace = Join-Path $ParentRoot "lfaa"

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
        Write-Label "【提示】" "【可关闭】" "全部更新操作已完成，现在可以安全关闭终端窗口。" Green
    }
    else {
        Write-Label "【提示】" "【可关闭】" "错误或阻止原因已经显示，现在可以关闭窗口；处理后再重新运行。" Yellow
    }

    Write-Label "【提示】" "【操作】" "按任意键关闭窗口，或直接点击右上角 X。" DarkGray

    try {
        [void][System.Console]::ReadKey($true)
    }
    catch {
    }
}

function Stop-Lfaa {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string[]]$TechnicalOutput = @()
    )

    Write-Host ""
    Write-Label "【错误】" "【停止】" $Message Red

    if ($TechnicalOutput.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
        try {
            $logDir = Join-Path $WorkspaceRoot "docs\logs\source-update"
            New-Item -ItemType Directory -Force -Path $logDir | Out-Null
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $logFile = Join-Path $logDir ("update-error-{0}.log" -f $stamp)

            $lines = New-Object System.Collections.Generic.List[string]
            $lines.Add("LFAA Source Update Error Log")
            $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
            $lines.Add("Message: " + $Message)
            $lines.Add("")
            $lines.Add("Raw Git Output:")
            foreach ($line in $TechnicalOutput) {
                $lines.Add([string]$line)
            }

            [System.IO.File]::WriteAllLines(
                $logFile,
                $lines,
                (New-Object System.Text.UTF8Encoding($true))
            )

            Write-Label "【日志】" "【技术详情】" $logFile DarkYellow
        }
        catch {
        }
    }

    Wait-LfaaClose -Success $false
    exit 1
}

function Invoke-GitRaw {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $captured = @(
            & git @GitArgs 2>&1 | ForEach-Object {
                [string]$_
            }
        )
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = $captured
    }
}

function Invoke-GitChecked {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs,
        [Parameter(Mandatory = $true)]
        [string]$ActionName
    )

    $result = Invoke-GitRaw -GitArgs $GitArgs

    if ($result.ExitCode -ne 0) {
        Stop-Lfaa -Message ($ActionName + "失败。") -TechnicalOutput $result.Output
    }

    return $result
}

function Get-ReleaseVersion {
    param([string]$Root)

    $releaseFile = Join-Path $Root "lfaa.release.json"

    if (-not (Test-Path -LiteralPath $releaseFile)) {
        return "unknown"
    }

    try {
        $releaseData = Get-Content -Raw -LiteralPath $releaseFile | ConvertFrom-Json
        if ($releaseData.displayVersion) {
            return [string]$releaseData.displayVersion
        }
    }
    catch {
    }

    return "unknown"
}

function Save-UpdateLog {
    param(
        [string]$Root,
        [string]$OriginUrl,
        [string]$Branch,
        [string]$OldCommit,
        [string]$NewCommit,
        [string[]]$ChangedFiles,
        [string]$Result
    )

    $logDir = Join-Path $Root "docs\logs\source-update"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logFile = Join-Path $logDir ("update-{0}.log" -f $stamp)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("LFAA Source Update Log")
    $lines.Add("Time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $lines.Add("Origin: " + $OriginUrl)
    $lines.Add("Branch: " + $Branch)
    $lines.Add("Before: " + $OldCommit)
    $lines.Add("After: " + $NewCommit)
    $lines.Add("Result: " + $Result)
    $lines.Add("")
    $lines.Add("Remote Changes:")

    foreach ($line in $ChangedFiles) {
        $lines.Add($line)
    }

    [System.IO.File]::WriteAllLines(
        $logFile,
        $lines,
        (New-Object System.Text.UTF8Encoding($true))
    )

    return $logFile
}

function Show-RemoteChanges {
    param([string[]]$Lines)

    $add = 0
    $mod = 0
    $del = 0
    $ren = 0
    $other = 0

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split "`t"
        $code = $parts[0]

        if ($code -match "^A") {
            $add++
        }
        elseif ($code -match "^M") {
            $mod++
        }
        elseif ($code -match "^D") {
            $del++
        }
        elseif ($code -match "^R") {
            $ren++
        }
        else {
            $other++
        }
    }

    Write-Host ""
    Write-Label "【远程变化】" "【汇总】" ("新增 {0} | 修改 {1} | 删除 {2} | 重命名 {3} | 其他 {4}" -f $add, $mod, $del, $ren, $other) Cyan
    Write-Host ""

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split "`t"
        $code = $parts[0]

        if ($code -match "^A") {
            Write-Label "【新增】" "【文件】" $parts[1] Green
        }
        elseif ($code -match "^M") {
            Write-Label "【修改】" "【文件】" $parts[1] Yellow
        }
        elseif ($code -match "^D") {
            Write-Label "【删除】" "【文件】" $parts[1] Red
        }
        elseif ($code -match "^R") {
            $text = if ($parts.Count -ge 3) {
                $parts[1] + " -> " + $parts[2]
            }
            else {
                $line
            }

            Write-Label "【重命名】" "【文件】" $text Magenta
        }
        else {
            Write-Label "【变更】" "【文件】" $line Cyan
        }
    }
}

# --------------------------------------------------------------
# 定位真正的 Git 工作区
# --------------------------------------------------------------
if (Test-Path -LiteralPath (Join-Path $PackageRoot ".git")) {
    $WorkspaceRoot = $PackageRoot
}
elseif (Test-Path -LiteralPath (Join-Path $SiblingStableWorkspace ".git")) {
    $WorkspaceRoot = (Resolve-Path $SiblingStableWorkspace).Path
}
else {
    $WorkspaceRoot = $PackageRoot
    Stop-Lfaa "没有找到可更新的 Git 工作区。请先完成一次 git clone，或先使用 LFAA-GitHub.bat 初始化稳定工作区。"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " LFAA 源码一键更新" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkCyan

Write-Label "【工作区】" "【路径】" $WorkspaceRoot Cyan

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-Lfaa "未检测到 Git，请先安装 Git for Windows 并加入系统 PATH。"
}

Set-Location $WorkspaceRoot

[void](Invoke-GitChecked -GitArgs @("config", "core.quotepath", "false") -ActionName "设置 Git 中文路径显示")

$version = Get-ReleaseVersion $WorkspaceRoot
Write-Label "【版本】" "【本地】" $version Magenta

# --------------------------------------------------------------
# 读取 origin
# --------------------------------------------------------------
$remoteList = Invoke-GitChecked -GitArgs @("remote") -ActionName "读取远程仓库"
$remotes = @($remoteList.Output | ForEach-Object { $_.Trim() } | Where-Object { $_ })

if ($remotes -notcontains "origin") {
    Stop-Lfaa "当前 Git 工作区没有 origin。请先运行 LFAA-GitHub.bat 配置远程仓库地址。"
}

$originResult = Invoke-GitChecked -GitArgs @("remote", "get-url", "origin") -ActionName "读取 origin 地址"
$origin = ($originResult.Output -join "").Trim()

Write-Label "【远程】" "【origin】" $origin Green

# --------------------------------------------------------------
# 当前分支
# --------------------------------------------------------------
$branchResult = Invoke-GitChecked -GitArgs @("branch", "--show-current") -ActionName "读取当前分支"
$branch = ($branchResult.Output -join "").Trim()

if ([string]::IsNullOrWhiteSpace($branch)) {
    Stop-Lfaa "当前仓库处于 detached HEAD 状态，为避免误更新，脚本已停止。"
}

Write-Label "【分支】" "【当前】" $branch Cyan

# --------------------------------------------------------------
# 本地未提交修改检查
# --------------------------------------------------------------
$statusResult = Invoke-GitChecked -GitArgs @(
    "-c", "core.quotepath=false",
    "status", "--porcelain=v1", "--untracked-files=all"
) -ActionName "读取本地文件状态"

$localChanges = @($statusResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ($localChanges.Count -gt 0) {
    Write-Host ""
    Write-Label "【保护】" "【未提交修改】" "检测到本地尚未提交的文件，为避免覆盖，已停止自动更新。" Yellow
    Write-Host ""

    foreach ($line in $localChanges) {
        if ($line.Length -ge 3) {
            $code = $line.Substring(0, 2)
            $path = $line.Substring(3).Trim()

            if ($code -match "A|\?") {
                Write-Label "【新增】" "【本地】" $path Green
            }
            elseif ($code -match "D") {
                Write-Label "【删除】" "【本地】" $path Red
            }
            elseif ($code -match "M") {
                Write-Label "【修改】" "【本地】" $path Yellow
            }
            else {
                Write-Label "【变更】" "【本地】" $path Cyan
            }
        }
    }

    Write-Host ""
    Write-Label "【处理】" "【建议】" "请先提交这些修改，或手工 git stash 后，再重新运行更新脚本。" DarkYellow
    Wait-LfaaClose -Success $false
    exit 2
}

Write-Label "【本地】" "【干净】" "未检测到未提交修改，可以安全检查远程更新。" Green

# --------------------------------------------------------------
# Fetch
# --------------------------------------------------------------
Write-Host ""
Write-Label "【远程】" "【获取】" "正在获取远程最新状态，请稍候..." Cyan

$fetchResult = Invoke-GitRaw -GitArgs @("fetch", "--prune", "origin")

if ($fetchResult.ExitCode -ne 0) {
    Stop-Lfaa -Message "获取远程更新失败，请检查网络、origin 地址或 Git 登录状态。" -TechnicalOutput $fetchResult.Output
}

Write-Label "【远程】" "【完成】" "远程状态获取完成。" Green

$remoteRef = "origin/" + $branch

$remoteRefCheck = Invoke-GitRaw -GitArgs @("rev-parse", "--verify", $remoteRef)
if ($remoteRefCheck.ExitCode -ne 0) {
    Stop-Lfaa -Message ("远程不存在分支：" + $remoteRef + "。") -TechnicalOutput $remoteRefCheck.Output
}

# --------------------------------------------------------------
# 判断 ahead / behind
# --------------------------------------------------------------
$countResult = Invoke-GitChecked -GitArgs @(
    "rev-list", "--left-right", "--count", "HEAD..." + $remoteRef
) -ActionName "比较本地与远程版本"

$countText = ($countResult.Output -join " ").Trim()
$countParts = $countText -split "\s+"

if ($countParts.Count -lt 2) {
    Stop-Lfaa "无法解析本地与远程版本差异。"
}

$ahead = [int]$countParts[0]
$behind = [int]$countParts[1]

Write-Host ""
Write-Label "【版本差异】" "【本地领先】" ($ahead.ToString() + " 个提交") Magenta
Write-Label "【版本差异】" "【本地落后】" ($behind.ToString() + " 个提交") Cyan

# Already up-to-date
if ($ahead -eq 0 -and $behind -eq 0) {
    Write-Host ""
    Write-Label "【更新】" "【已是最新】" "当前源码已经是远程最新版本，无需拉取。" Green
    Wait-LfaaClose -Success $true
    exit 0
}

# Local only ahead
if ($ahead -gt 0 -and $behind -eq 0) {
    Write-Host ""
    Write-Label "【保护】" "【本地领先】" "本地存在尚未出现在远程的 Commit，不需要拉取远程源码。" Yellow
    Write-Label "【处理】" "【建议】" "如果这些 Commit 应该上传，请使用 LFAA-GitHub.bat 推送。" DarkYellow
    Wait-LfaaClose -Success $true
    exit 0
}

# Diverged
if ($ahead -gt 0 -and $behind -gt 0) {
    Write-Host ""
    Write-Label "【保护】" "【分支已分叉】" "本地和远程都存在各自的新 Commit，自动更新已停止。" Red
    Write-Label "【原因】" "【安全】" "此状态需要人工决定 rebase / merge，脚本不会自动改写历史。" Yellow
    Write-Label "【处理】" "【建议】" "请先处理分支差异，再重新运行 LFAA-Update.bat。" DarkYellow
    Wait-LfaaClose -Success $false
    exit 2
}

# --------------------------------------------------------------
# Safe behind-only update
# --------------------------------------------------------------
$oldHeadResult = Invoke-GitChecked -GitArgs @("rev-parse", "HEAD") -ActionName "读取当前 Commit"
$oldHead = ($oldHeadResult.Output -join "").Trim()

$diffResult = Invoke-GitChecked -GitArgs @(
    "-c", "core.quotepath=false",
    "diff", "--name-status", "--find-renames", "HEAD.." + $remoteRef
) -ActionName "读取远程文件变化"

$remoteChanges = @($diffResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

Show-RemoteChanges -Lines $remoteChanges

Write-Host ""
Write-Label "【更新】" "【提交数量】" ("将拉取 " + $behind + " 个远程 Commit。") Cyan
Write-Label "【更新】" "【方式】" "使用 fast-forward only，不执行自动 merge/rebase。" DarkCyan

$confirm = Read-Host "【确认】【拉取最新源码】输入 Y 确认，其他键取消"

if ($confirm -notmatch "^(?i:y|yes)$") {
    Write-Label "【取消】" "【更新】" "已取消，本地源码未发生改变。" Yellow
    Wait-LfaaClose -Success $true
    exit 0
}

Write-Host ""
Write-Label "【更新】" "【进行中】" "正在拉取远程最新源码..." Cyan

$pullResult = Invoke-GitRaw -GitArgs @("pull", "--ff-only", "origin", $branch)

if ($pullResult.ExitCode -ne 0) {
    Stop-Lfaa -Message "拉取远程源码失败。为保护本地历史，脚本没有执行强制覆盖。" -TechnicalOutput $pullResult.Output
}

$newHeadResult = Invoke-GitChecked -GitArgs @("rev-parse", "HEAD") -ActionName "读取更新后 Commit"
$newHead = ($newHeadResult.Output -join "").Trim()

# Verify local now equals remote.
$verifyResult = Invoke-GitChecked -GitArgs @(
    "rev-list", "--left-right", "--count", "HEAD..." + $remoteRef
) -ActionName "校验更新结果"

$verifyText = ($verifyResult.Output -join " ").Trim()
$verifyParts = $verifyText -split "\s+"

if ($verifyParts.Count -lt 2 -or [int]$verifyParts[0] -ne 0 -or [int]$verifyParts[1] -ne 0) {
    Stop-Lfaa "更新命令完成，但本地 HEAD 与远程分支仍不一致，已停止继续操作。"
}

$newVersion = Get-ReleaseVersion $WorkspaceRoot
$logFile = Save-UpdateLog `
    -Root $WorkspaceRoot `
    -OriginUrl $origin `
    -Branch $branch `
    -OldCommit $oldHead `
    -NewCommit $newHead `
    -ChangedFiles $remoteChanges `
    -Result "SUCCESS"

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGreen
Write-Label "【完成】" "【更新成功】" "本地源码已更新到远程最新版本。" Green
Write-Label "【版本】" "【更新前】" $version Magenta
Write-Label "【版本】" "【更新后】" $newVersion Green
Write-Label "【分支】" "【名称】" $branch Cyan
Write-Label "【日志】" "【路径】" $logFile DarkCyan
Write-Host "============================================================" -ForegroundColor DarkGreen

Wait-LfaaClose -Success $true
exit 0
