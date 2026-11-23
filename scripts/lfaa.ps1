# LFAA Windows 菜单入口：安装当前工作区依赖，并在应用入口就绪后启动 Web。
# 支持 `lfaa.bat`（菜单）、`lfaa.bat 2`（直接执行菜单项后退出）、`lfaa.bat --help`（用法）。
$ErrorActionPreference = "Stop"
# 原生命令（git / pnpm / node）在 Windows 上输出 UTF-8；Windows PowerShell 5.1 默认按本地 OEM 代码页解码，
# 会把中文提交信息读成乱码。显式按 UTF-8 解码；PowerShell 自身输出走 WriteConsoleW，不受影响。
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# 统一检查 pnpm 并保留其退出码，供菜单反馈安装或启动结果。
function Invoke-Pnpm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "未找到 pnpm，请先安装 Node.js 和 pnpm。" -ForegroundColor Red
    $script:PnpmExitCode = 127
    return
  }

  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & pnpm @Arguments
    if ($null -eq $LASTEXITCODE) {
      $script:PnpmExitCode = 1
    } else {
      $script:PnpmExitCode = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $prevErrorAction
  }
}

# 清理上次中断残留在 .pnpm 中的 *_tmp_* 临时目录，避免重装时残留冲突。
function Clear-StalePnpmTempDirs {
  $virtualStore = Join-Path $repoRoot "node_modules/.pnpm"
  if (-not (Test-Path -LiteralPath $virtualStore)) { return }
  Get-ChildItem -LiteralPath $virtualStore -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $nm = Join-Path $_.FullName "node_modules"
    if (-not (Test-Path -LiteralPath $nm)) { return }
    Get-ChildItem -LiteralPath $nm -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -like "*_tmp_*") {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
      } elseif ($_.Name.StartsWith("@")) {
        Get-ChildItem -LiteralPath $_.FullName -Directory -Filter "*_tmp_*" -ErrorAction SilentlyContinue | ForEach-Object {
          Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
      }
    }
  }
}

# 统一检查 git 并保留其退出码，供一键推送流程处理分支与提交结果。
function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "未找到 git，请先安装 Git。" -ForegroundColor Red
    $script:GitExitCode = 127
    return
  }

  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & git @Arguments
    if ($null -eq $LASTEXITCODE) {
      $script:GitExitCode = 1
    } else {
      $script:GitExitCode = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $prevErrorAction
  }
}

# 推送前安全检查：拦截大文件（>5MB）、依赖/构建产物、敏感凭据文件及疑似明文密钥内容。
function Test-PushSafety {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Scope # "staged" 或 "tracked"
  )

  $maxBytes = 5 * 1024 * 1024
  $rawFiles = if ($Scope -eq "staged") {
    & git diff --cached --name-only --diff-filter=ACMR 2>$null
  } else {
    & git ls-files 2>$null
  }

  $violations = [System.Collections.Generic.List[string]]::new()
  $blockedDirRegex = '(^|/)(node_modules|\.pnpm|\.pnpm-store|dist|build|coverage|\.turbo|\.cache|\.vite)(/|$)|\.tsbuildinfo$'
  $sensitiveFileRegex = '(^|/)(\.env($|\.(?!example$|template$))|id_rsa|id_ed25519)|(^|/)\.lfaa/|\.(pem|key|p12|pfx|jks|keystore|db|sqlite|sqlite3)$|(^|/)[^/]*(credentials|secret)[^/]*\.json$'
  $binaryExtRegex = '\.(png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|eot|zip|7z|rar|tar|gz|tgz|exe|msi|dmg|iso|bin|pdf)$'
  $testSkipRegex = '\.(test|spec|fixture)\.[a-z0-9]+$'
  $secretContentRegex = '-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z\-_]{35}\b|\bsk-(?:proj-|ant-)?[A-Za-z0-9]{24,}\b'

  foreach ($relPath in $rawFiles) {
    if ([string]::IsNullOrWhiteSpace($relPath)) { continue }
    $normalized = $relPath.Replace('\', '/').Trim()
    $fullPath = Join-Path $repoRoot $relPath

    if ($normalized -match $blockedDirRegex) {
      $violations.Add("[依赖/构建产物] $normalized")
      continue
    }
    if ($normalized -match $sensitiveFileRegex) {
      $violations.Add("[敏感文件] $normalized")
      continue
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { continue }

    $item = Get-Item -LiteralPath $fullPath -ErrorAction SilentlyContinue
    if ($null -eq $item) { continue }
    if ($item.Length -gt $maxBytes) {
      $sizeMb = [math]::Round($item.Length / 1MB, 2)
      $violations.Add("[大文件 ${sizeMb}MB > 5MB] $normalized")
      continue
    }

    if ($normalized -notmatch $binaryExtRegex -and $normalized -notmatch $testSkipRegex -and $item.Length -le 2MB) {
      try {
        $text = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
        if ($text -match $secretContentRegex) {
          $violations.Add("[疑似明文密钥/Token] $normalized")
        }
      } catch {
        # 非 UTF-8 文本文件跳过内容扫描。
      }
    }
  }

  if ($violations.Count -gt 0) {
    Write-Host ""
    Write-Host "安全检查未通过，已拦截本次提交/推送！发现以下风险文件：" -ForegroundColor Red
    foreach ($v in $violations) {
      Write-Host "  - $v" -ForegroundColor Red
    }
    Write-Host "请将其移出仓库、写入 .gitignore 或脱敏后再重试（已执行 git reset 取消本次暂存）。" -ForegroundColor Yellow
    if ($Scope -eq "staged") {
      & git reset -q 2>$null
    }
    return $false
  }

  return $true
}

# 读取仓库最新一次提交的信息；没有 HEAD 时才回退到菜单上次写入的记录。
# 必须先读真实 HEAD：菜单外的 git commit 不会更新 LastMsgFile，反过来读会显示过期信息。
function Get-LastCommitMessage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LastMsgFile,
    [Parameter(Mandatory = $true)]
    [bool]$HasHead
  )

  if ($HasHead) {
    $latest = (& git -c i18n.logOutputEncoding=utf-8 log -1 --pretty=%s 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($latest)) {
      return $latest
    }
  }

  if (Test-Path -LiteralPath $LastMsgFile) {
    $saved = [System.IO.File]::ReadAllText($LastMsgFile, [System.Text.UTF8Encoding]::new($false)).Trim()
    if (-not [string]::IsNullOrWhiteSpace($saved)) {
      return $saved
    }
  }

  return ""
}

# 列出待推送的提交（一行一条）；远程引用不存在或没有差异时返回空数组。
function Get-PendingCommits {
  param(
    [string]$Range = "origin/main..HEAD"
  )

  $output = (& git -c i18n.logOutputEncoding=utf-8 log --oneline $Range 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($output)) {
    return @()
  }
  return @($output -split "\r?\n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

# 确保 Git 可用、仓库已初始化为 main 分支，并将 origin 指向指定 GitHub 地址。
function Initialize-GitOrigin {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RemoteUrl
  )

  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "未找到 git，请先安装 Git。" -ForegroundColor Red
    return $false
  }

  $gitDir = Join-Path $repoRoot ".git"
  if (-not (Test-Path -LiteralPath $gitDir)) {
    Write-Host "当前目录尚未初始化 Git 仓库，正在初始化 main 分支..." -ForegroundColor Cyan
    Invoke-Git -Arguments @("init", "-b", "main")
    if ($script:GitExitCode -ne 0) {
      Invoke-Git -Arguments @("init")
      if ($script:GitExitCode -ne 0) {
        Write-Host "git init 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
        return $false
      }
      & git checkout -B main | Out-Null
    }
  }

  $existingOrigin = (& git remote get-url origin 2>$null | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($existingOrigin)) {
    Invoke-Git -Arguments @("remote", "add", "origin", $RemoteUrl)
    if ($script:GitExitCode -ne 0) { return $false }
  } elseif ($existingOrigin -ne $RemoteUrl) {
    Invoke-Git -Arguments @("remote", "set-url", "origin", $RemoteUrl)
    if ($script:GitExitCode -ne 0) { return $false }
  }

  return $true
}

# 一键初始化/关联 GitHub 远程仓库并推送当前工作区全部内容；通过 -Force 切换普通推送或强制推送。
function Push-ToGitHub {
  param(
    [switch]$Force
  )

  # GitHub 的规范仓库名是 LFAA（大写）：用小写地址推送时服务器会回 "repository moved" 提示。
  $remoteUrl = "https://github.com/yubboo/LFAA.git"
  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if (-not (Initialize-GitOrigin -RemoteUrl $remoteUrl)) { return }
    $gitDir = Join-Path $repoRoot ".git"

    $userName = (& git config user.name 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($userName)) {
      $inputName = Read-Host "未检测到 Git user.name，请输入提交用户名（回车默认 yubboo）"
      if ([string]::IsNullOrWhiteSpace($inputName)) { $inputName = "yubboo" }
      Invoke-Git -Arguments @("config", "user.name", $inputName.Trim())
      if ($script:GitExitCode -ne 0) { return }
    }

    $userEmail = (& git config user.email 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($userEmail)) {
      $inputEmail = Read-Host "未检测到 Git user.email，请输入提交邮箱（回车默认 yubboo@users.noreply.github.com）"
      if ([string]::IsNullOrWhiteSpace($inputEmail)) { $inputEmail = "yubboo@users.noreply.github.com" }
      Invoke-Git -Arguments @("config", "user.email", $inputEmail.Trim())
      if ($script:GitExitCode -ne 0) { return }
    }

    Write-Host "正在暂存工作区变更（遵循 .gitignore）..." -ForegroundColor Cyan
    Invoke-Git -Arguments @("add", "-A")
    if ($script:GitExitCode -ne 0) {
      Write-Host "git add 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
      return
    }

    if (-not (Test-PushSafety -Scope "staged")) { return }

    & git rev-parse --verify HEAD *> $null
    $hasHead = ($LASTEXITCODE -eq 0)
    & git diff --cached --quiet *> $null
    $hasStagedChanges = ($LASTEXITCODE -ne 0)

    $lastMsgFile = Join-Path $gitDir "lfaa-last-commit-msg.txt"
    $lastCommitMsg = Get-LastCommitMessage -LastMsgFile $lastMsgFile -HasHead $hasHead

    if (-not $hasHead -or $hasStagedChanges) {
      if (-not [string]::IsNullOrWhiteSpace($lastCommitMsg)) {
        Write-Host "上次提交的信息是：$lastCommitMsg" -ForegroundColor Yellow
        $inputMsg = Read-Host "请输入本次 commit 提交信息（直接回车沿用上次信息，输入 q 取消）"
        if ($inputMsg.Trim().ToLowerInvariant() -eq "q") {
          Write-Host "已取消本次提交与推送。" -ForegroundColor DarkGray
          return
        }
        $commitMsg = if ([string]::IsNullOrWhiteSpace($inputMsg)) { $lastCommitMsg } else { $inputMsg.Trim() }
      } else {
        $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $defaultMsg = "chore: sync LFAA workspace ($stamp)"
        $inputMsg = Read-Host "请输入本次 commit 提交信息（直接回车使用默认：$defaultMsg，输入 q 取消）"
        if ($inputMsg.Trim().ToLowerInvariant() -eq "q") {
          Write-Host "已取消本次提交与推送。" -ForegroundColor DarkGray
          return
        }
        $commitMsg = if ([string]::IsNullOrWhiteSpace($inputMsg)) { $defaultMsg } else { $inputMsg.Trim() }
      }

      Write-Host "正在创建提交：$commitMsg" -ForegroundColor Cyan
      Invoke-Git -Arguments @("commit", "-m", $commitMsg)
      if ($script:GitExitCode -ne 0) {
        Write-Host "git commit 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
        # pre-commit 的空白检查最常见；把具体文件与行号直接打出来，省得自己去猜。
        $whitespace = (& git diff --cached --check 2>&1 | Out-String).Trim()
        if (-not [string]::IsNullOrWhiteSpace($whitespace)) {
          Write-Host "暂存内容有空白问题（pre-commit 会拦下），位置：" -ForegroundColor Yellow
          $whitespace -split "`r?`n" | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
          Write-Host "修好后重新运行菜单 4 / 5 即可；确认为误报再用 git commit --no-verify。" -ForegroundColor Yellow
        } else {
          Write-Host "空白检查没问题，失败原因看上面的钩子输出。" -ForegroundColor DarkGray
        }
        return
      }
      [System.IO.File]::WriteAllText($lastMsgFile, $commitMsg, [System.Text.UTF8Encoding]::new($false))
    } else {
      if (-not [string]::IsNullOrWhiteSpace($lastCommitMsg)) {
        Write-Host "当前 HEAD：$lastCommitMsg" -ForegroundColor Yellow
      }
      if ($Force) {
        Write-Host "工作区无新改动；强制推送仍会覆盖远端同名分支。" -ForegroundColor DarkGray
      } else {
        Write-Host "工作区无新改动，继续推送已有提交。" -ForegroundColor DarkGray
      }
    }

    if (-not (Test-PushSafety -Scope "tracked")) { return }

    # 把「到底推了什么」说清楚：菜单外的 git commit 也会在这里列出，而不是只报一句「直接推送」。
    $pendingCommits = @(Get-PendingCommits)
    $remoteRef = (& git rev-parse --verify --quiet "refs/remotes/origin/main" 2>$null | Out-String).Trim()
    $hasRemoteRef = -not [string]::IsNullOrWhiteSpace($remoteRef)
    if (-not $Force -and $hasRemoteRef -and $pendingCommits.Count -eq 0) {
      Write-Host "本地已与 origin/main 同步，没有需要推送的提交。" -ForegroundColor Green
      return
    }
    if ($pendingCommits.Count -gt 0) {
      Write-Host "将推送 $($pendingCommits.Count) 个提交：" -ForegroundColor Cyan
      foreach ($line in $pendingCommits) {
        Write-Host "  $line" -ForegroundColor DarkGray
      }
    }

    $currentBranch = (& git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($currentBranch) -or $currentBranch -eq "HEAD") {
      $currentBranch = "main"
      & git branch -M main | Out-Null
    }

    if ($Force) {
      # --force-with-lease：远端在我们上次拉取后被别人更新时先失败，避免误伤他人提交。
      Write-Host "正在强制推送到 $remoteUrl（${currentBranch} -> main）..." -ForegroundColor Yellow
      Invoke-Git -Arguments @("push", "--force-with-lease", "-u", "origin", "${currentBranch}:main")
      if ($script:GitExitCode -ne 0) {
        Write-Host "强制推送被拒绝：远端可能已有新提交（这是 --force-with-lease 的保护）。" -ForegroundColor Yellow
        $overwrite = Read-Host "确认丢弃远端最新提交并覆盖吗？输入 yes 继续，回车取消"
        if ($overwrite.Trim() -eq "yes") {
          Invoke-Git -Arguments @("push", "--force", "-u", "origin", "${currentBranch}:main")
        } else {
          Write-Host "已取消强制推送。" -ForegroundColor DarkGray
          return
        }
      }
    } else {
      Write-Host "正在推送到 $remoteUrl（${currentBranch} -> main）..." -ForegroundColor Cyan
      Invoke-Git -Arguments @("push", "-u", "origin", "${currentBranch}:main")
    }
    if ($script:GitExitCode -eq 0) {
      if ($Force) {
        Write-Host "强制推送成功：$remoteUrl (main)" -ForegroundColor Green
      } else {
        Write-Host "推送成功：$remoteUrl (main)" -ForegroundColor Green
      }
    } else {
      if ($Force) {
        Write-Host "强制推送失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
      } else {
        Write-Host "推送失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
        # 最常见的失败是「远端有本地没有的提交」，普通推送不会覆盖，直接给出三条出路。
        Write-Host "常见原因：远端分支上还有你本地没有的提交。可以这样处理：" -ForegroundColor Yellow
        Write-Host "  · 选 5 强制覆盖远端（会丢弃远端那些提交，先确认它们不是你要保留的）" -ForegroundColor DarkGray
        Write-Host "  · 选 6 先拉取并整合远端改动，再回来推送" -ForegroundColor DarkGray
        Write-Host "  · 或者保留两边历史，推成新分支：git push origin main:lfaa-app" -ForegroundColor DarkGray
      }
    }
  } finally {
    $ErrorActionPreference = $prevErrorAction
  }
}

# 从 GitHub 远程仓库拉取 main 分支最新源码并安全更新本地工作区。
function Pull-FromGitHub {
  $remoteUrl = "https://github.com/yubboo/LFAA.git"
  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if (-not (Initialize-GitOrigin -RemoteUrl $remoteUrl)) { return }

    Write-Host "正在从 $remoteUrl 获取最新源码（origin/main）..." -ForegroundColor Cyan
    Invoke-Git -Arguments @("fetch", "origin", "main")
    if ($script:GitExitCode -ne 0) {
      Write-Host "获取远程分支失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
      return
    }

    $remoteHead = (& git rev-parse --verify origin/main 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteHead)) {
      Write-Host "远程仓库尚未存在 main 分支，请先推送后再拉取。" -ForegroundColor Yellow
      return
    }

    $remoteShort = $remoteHead.Substring(0, [Math]::Min(7, $remoteHead.Length))
    $remoteSubject = (& git -c i18n.logOutputEncoding=utf-8 log -1 --pretty=%s origin/main 2>$null | Out-String).Trim()
    $remoteDate = (& git log -1 --date=format:"%Y-%m-%d %H:%M:%S" --pretty=%cd origin/main 2>$null | Out-String).Trim()
    $remoteDesc = if ([string]::IsNullOrWhiteSpace($remoteSubject)) { $remoteShort } else { "$remoteSubject（$remoteShort, $remoteDate）" }

    $beforeHead = (& git rev-parse --verify HEAD 2>$null | Out-String).Trim()
    $hasHead = ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($beforeHead))
    $statusLines = (& git status --porcelain 2>$null | Out-String).Trim()
    $isDirty = -not [string]::IsNullOrWhiteSpace($statusLines)

    if ($hasHead -and $beforeHead -eq $remoteHead) {
      Write-Host "远程最新提交：$remoteDesc" -ForegroundColor Cyan
      if (-not $isDirty) {
        Write-Host "本地源码已是最新版本，无需更新。" -ForegroundColor Green
        return
      }
      Write-Host "远程已是最新提交，但本地存在未提交改动：" -ForegroundColor Yellow
      & git status --short
      $discardChoice = Read-Host "输入 y 将本地改动还原为远程最新源码，直接回车保留本地改动"
      if ($discardChoice.Trim().ToLowerInvariant() -ne "y") {
        Write-Host "已保留本地未提交改动。" -ForegroundColor DarkGray
        return
      }
      Invoke-Git -Arguments @("reset", "--hard", "origin/main")
      if ($script:GitExitCode -ne 0) { return }
      Invoke-Git -Arguments @("clean", "-fd")
      Write-Host "已将本地工作区同步为远程最新源码。" -ForegroundColor Green
      return
    }

    Write-Host "你正在拉取远程仓库最新源码：$remoteDesc" -ForegroundColor Yellow
    $confirmPull = Read-Host "是否确认拉取？[Y/n]（直接回车默认 y，输入 n 取消）"
    $normalizedConfirm = $confirmPull.Trim().ToLowerInvariant()
    if (-not ([string]::IsNullOrWhiteSpace($normalizedConfirm) -or $normalizedConfirm -eq "y" -or $normalizedConfirm -eq "yes")) {
      Write-Host "已取消拉取。" -ForegroundColor DarkGray
      return
    }

    $stashed = $false
    if (-not $hasHead) {
      if ($isDirty) {
        Write-Host "当前目录已有文件且尚未建立提交历史，直接同步将用远程 main 覆盖同名源码（保留 node_modules 和 .env）。" -ForegroundColor Yellow
        $confirmInitPull = Read-Host "输入 y 确认拉取并对齐远程 main，直接回车取消"
        if ($confirmInitPull.Trim().ToLowerInvariant() -ne "y") {
          Write-Host "已取消拉取。" -ForegroundColor DarkGray
          return
        }
      }
      Invoke-Git -Arguments @("checkout", "-f", "-B", "main", "origin/main")
      if ($script:GitExitCode -ne 0) {
        Write-Host "切换并对齐 main 分支失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
        return
      }
    } else {
      if ($isDirty) {
        Write-Host "检测到本地有未提交改动：" -ForegroundColor Yellow
        & git status --short
        Write-Host "1. 暂存本地改动，拉取后再自动恢复（git stash + pull + pop）"
        Write-Host "2. 放弃本地未提交改动，直接同步为远程最新源码（保留 node_modules 和 .env）"
        Write-Host "q. 取消拉取"
        $dirtyChoice = Read-Host "请选择处理方式"
        switch ($dirtyChoice.Trim().ToLowerInvariant()) {
          "1" {
            Invoke-Git -Arguments @("stash", "push", "-u", "-m", "lfaa-auto-stash-before-pull")
            if ($script:GitExitCode -ne 0) {
              Write-Host "暂存本地改动失败，已取消拉取。" -ForegroundColor Red
              return
            }
            $stashed = $true
          }
          "2" {
            Invoke-Git -Arguments @("checkout", "-B", "main")
            if ($script:GitExitCode -ne 0) { return }
            Invoke-Git -Arguments @("reset", "--hard", "origin/main")
            if ($script:GitExitCode -ne 0) { return }
            Invoke-Git -Arguments @("clean", "-fd")
            if ($script:GitExitCode -ne 0) { return }
          }
          default {
            Write-Host "已取消拉取。" -ForegroundColor DarkGray
            return
          }
        }
      }

      $afterDirtyReset = (& git rev-parse --verify HEAD 2>$null | Out-String).Trim()
      if ($afterDirtyReset -ne $remoteHead) {
        Invoke-Git -Arguments @("checkout", "-B", "main")
        if ($script:GitExitCode -ne 0) { return }

        Invoke-Git -Arguments @("merge", "--ff-only", "origin/main")
        if ($script:GitExitCode -ne 0) {
          Write-Host "无法直接快进合并（本地与 GitHub 历史存在分叉，可能由强制推送引起）：" -ForegroundColor Yellow
          Write-Host "1. 以 GitHub 远程最新源码为准对齐本地（git reset --hard origin/main）"
          Write-Host "2. 变基保留本地提交（git rebase origin/main）"
          Write-Host "q. 取消"
          $divergeChoice = Read-Host "请选择合并策略"
          switch ($divergeChoice.Trim()) {
            "1" {
              Invoke-Git -Arguments @("reset", "--hard", "origin/main")
              if ($script:GitExitCode -ne 0) { return }
            }
            "2" {
              Invoke-Git -Arguments @("rebase", "origin/main")
              if ($script:GitExitCode -ne 0) {
                Write-Host "变基出现冲突，请手动解决或运行 git rebase --abort。" -ForegroundColor Red
                return
              }
            }
            default {
              Write-Host "已取消拉取。" -ForegroundColor DarkGray
              if ($stashed) { & git stash pop | Out-Null }
              return
            }
          }
        }
      }

      if ($stashed) {
        Write-Host "正在恢复暂存的本地改动..." -ForegroundColor Cyan
        Invoke-Git -Arguments @("stash", "pop")
        if ($script:GitExitCode -ne 0) {
          Write-Host "源码已更新，但恢复暂存改动时发生冲突，请手动处理后清理 stash。" -ForegroundColor Yellow
        }
      }
    }

    $afterHead = (& git rev-parse --verify HEAD 2>$null | Out-String).Trim()
    $latestLog = (& git -c i18n.logOutputEncoding=utf-8 log -1 --oneline 2>$null | Out-String).Trim()
    Write-Host "拉取完成，当前版本：$latestLog" -ForegroundColor Green

    if ($hasHead -and $afterHead -and $beforeHead -ne $afterHead) {
      $changedFiles = (& git diff --name-only $beforeHead $afterHead 2>$null)
      if ($changedFiles -match "^(package\.json|pnpm-lock\.yaml)$") {
        Write-Host "提示：检测到依赖清单有更新，建议运行菜单 1（安装依赖）。" -ForegroundColor Cyan
      }
      if ($changedFiles -contains "scripts/lfaa.ps1") {
        Write-Host "提示：菜单脚本自身已更新，建议输入 0 退出后重新启动 lfaa.bat。" -ForegroundColor Yellow
      }
    }
  } finally {
    $ErrorActionPreference = $prevErrorAction
  }
}

# 检测是否通过双击 lfaa.bat 在独立终端窗口中启动，以便退出菜单时保留窗口不自动关闭。
function Test-LaunchedStandalone {
  try {
    $self = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction Stop
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($self.ParentProcessId)" -ErrorAction Stop
    if ($parent.Name -ieq "cmd.exe") {
      $grand = Get-CimInstance Win32_Process -Filter "ProcessId=$($parent.ParentProcessId)" -ErrorAction SilentlyContinue
      if ($null -eq $grand -or $grand.Name -notin @("cmd.exe", "powershell.exe", "pwsh.exe")) {
        return $true
      }
    }
  } catch {
    # 进程查询受限时保守退回常规退出。
  }
  return $false
}

# 启动前释放 LFAA Web 占用的本地端口：仅结束后台监听且命令行属于本仓库的 node/pnpm 进程，避免误杀其他程序。
function Stop-LfaaWebListeners {
  $ports = @(5173, 5174, 5175, 5176, 5177)
  $released = 0
  foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { continue }
    $processId = $conn.OwningProcess
    if (-not $processId) { continue }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    $commandLine = $process.CommandLine
    if (-not $commandLine) { continue }
    $isLfaaProcess = $commandLine -match "lfaa" -or $commandLine -match [regex]::Escape($repoRoot)
    if (-not $isLfaaProcess) {
      Write-Host "端口 $port 被其他程序占用（PID $processId），未自动释放。" -ForegroundColor Yellow
      continue
    }
    Write-Host "释放端口 $port：结束旧的 LFAA Web 进程（PID $processId）..." -ForegroundColor Cyan
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $released += 1
    Start-Sleep -Milliseconds 600
  }
  if ($released -eq 0) {
    Write-Host "端口 5173 空闲，直接启动。" -ForegroundColor DarkGray
  }
}

# 菜单渲染独立成函数：一次性执行带编号参数时不需要打印菜单。
function Show-Menu {
  Write-Host ""
  Write-Host "================ LFAA ================" -ForegroundColor Cyan
  Write-Host "【开发与运行】" -ForegroundColor Cyan
  Write-Host "  1. 安装依赖（pnpm install --prefer-offline）" -ForegroundColor White
  Write-Host "  2. 启动 Web（自动结束旧进程并占用 5173 重启）" -ForegroundColor Green
  Write-Host "  3. 启动桌面端（Electron 窗口，复用已构建产物）" -ForegroundColor Green
  Write-Host "  7. 构建桌面端安装包（NSIS → apps/desktop/.desktop-build/release）" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "【GitHub 源码同步 · yubboo/LFAA】" -ForegroundColor Magenta
  Write-Host "  4. 一键推送到 GitHub（普通推送 + 安全检测）" -ForegroundColor White
  Write-Host "  5. 一键强制推送到 GitHub（覆盖远程，谨慎使用）" -ForegroundColor Yellow
  Write-Host "  6. 拉取 GitHub 最新源码到本地（预览提交 + 确认）" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "【其他】" -ForegroundColor DarkGray
  Write-Host "  0. 退出菜单（保留终端窗口）" -ForegroundColor DarkGray
  Write-Host "======================================" -ForegroundColor Cyan
  Write-Host "用法：lfaa.bat [0-7] 直接执行一项后退出；lfaa.bat --help 看说明。" -ForegroundColor DarkGray
}

# 执行一个菜单项。所有动作都在这里收敛，异常由调用方捕获，菜单不会因为单个动作失败而退出。
function Invoke-MenuChoice {
  param([string]$Choice)

  switch ($Choice) {
    "1" {
      Clear-StalePnpmTempDirs
      Invoke-Pnpm -Arguments @("install", "--prefer-offline")
      $exitCode = $script:PnpmExitCode
      if ($exitCode -eq 0) {
        Write-Host "依赖安装完成。" -ForegroundColor Green
      } elseif ($exitCode -eq -1) {
        Write-Host "依赖安装失败，退出码：-1（进程可能被取消/中断，或被另一个正在运行的 pnpm/文件锁阻塞）。" -ForegroundColor Red
      } else {
        Write-Host "依赖安装失败，退出码：$exitCode" -ForegroundColor Red
      }
    }
    "2" {
      $manifest = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
      $cliEntry = Join-Path $repoRoot "apps/cli/src/bin.ts"
      $webEntry = Join-Path $repoRoot "apps/web/src/main.tsx"
      if (-not $manifest.scripts -or -not $manifest.scripts.lfaa -or -not (Test-Path -LiteralPath $cliEntry) -or -not (Test-Path -LiteralPath $webEntry)) {
        Write-Host "Web 启动入口尚未就绪，请检查 apps/cli、apps/web 和根 package.json。" -ForegroundColor Yellow
        return
      }

      if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "未找到 Node.js，无法检查依赖。" -ForegroundColor Red
        return
      }

      # 启动前释放被占用的 5173~5177 端口，避免每次都要手动关掉旧进程。
      Stop-LfaaWebListeners

      # 依赖状态检查成功后才启动，避免把依赖错误隐藏为服务启动失败。
      & node (Join-Path $PSScriptRoot "ensure-dependencies.mjs")
      $exitCode = $LASTEXITCODE
      if ($exitCode -eq 0) {
        Invoke-Pnpm -Arguments @("lfaa", "web")
        $exitCode = $script:PnpmExitCode
      } else {
        Write-Host "依赖检查或安装失败，未启动 Web。" -ForegroundColor Red
      }
      if ($exitCode -ne 0) {
        Write-Host "LFAA Web 启动失败，退出码：$exitCode" -ForegroundColor Red
      }
    }
    "3" {
      # 桌面端依赖 packages/lib 与 Web 产物；缺产物时给出明确构建入口，不静默启动空窗口。
      $desktopEntry = Join-Path $repoRoot "apps/desktop/dist/main.js"
      $webDist = Join-Path $repoRoot "apps/web/dist/index.html"
      $hostLib = Join-Path $repoRoot "packages/host/web-server/lib/index.js"
      if (-not (Test-Path -LiteralPath $desktopEntry) -or -not (Test-Path -LiteralPath $webDist) -or -not (Test-Path -LiteralPath $hostLib)) {
        Write-Host "桌面端产物不完整，请先执行菜单 7 或命令 pnpm build:desktop。" -ForegroundColor Yellow
        return
      }
      Invoke-Pnpm -Arguments @("desktop")
      if ($script:PnpmExitCode -ne 0) {
        Write-Host "LFAA 桌面端启动失败，退出码：$($script:PnpmExitCode)" -ForegroundColor Red
      }
    }
    "7" {
      Write-Host "开始构建桌面端安装包（全量构建 + staging + NSIS，通常需要几分钟）..." -ForegroundColor Cyan
      Invoke-Pnpm -Arguments @("build:desktop")
      if ($script:PnpmExitCode -eq 0) {
        $releaseDir = Join-Path $repoRoot "apps/desktop/.desktop-build/release"
        Write-Host "桌面端安装包已生成：$releaseDir" -ForegroundColor Green
        Get-ChildItem -LiteralPath $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
          Write-Host "  · $($_.Name)" -ForegroundColor White
        }
      } else {
        Write-Host "桌面端构建失败，退出码：$($script:PnpmExitCode)" -ForegroundColor Red
      }
    }
    "4" {
      Push-ToGitHub
    }
    "5" {
      Push-ToGitHub -Force
    }
    "6" {
      Pull-FromGitHub
    }
    "0" {
      if (Test-LaunchedStandalone) {
        Write-Host "已退出 LFAA 菜单，当前终端窗口已保留（可继续输入命令，输入 exit 关闭）。" -ForegroundColor DarkGray
        exit 88
      }
      Write-Host "已退出 LFAA 菜单。" -ForegroundColor DarkGray
      exit 0
    }
    default { Write-Host "无效选项，请输入 1、2、3、7、4、5、6 或 0。" -ForegroundColor Yellow }
  }
}

# 打印用法；带参数启动时使用。
function Show-Usage {
  Write-Host ""
  Write-Host "LFAA 启动器" -ForegroundColor Cyan
  Write-Host "  lfaa.bat            打开菜单"
  Write-Host "  lfaa.bat <0-7>      直接执行对应菜单项后退出（适合快捷方式 / 脚本调用）"
  Write-Host "  lfaa.bat --help     显示本说明"
  Write-Host ""
  Write-Host "菜单项：1 安装依赖 · 2 启动 Web · 3 启动桌面端 · 4 推送 · 5 强制推送 · 6 拉取 · 7 构建安装包 · 0 退出" -ForegroundColor DarkGray
}

# 命令行参数：支持 `lfaa.bat 2` 这类一次性执行，其他参数给出用法并返回非零。
$argument = if ($args.Count -gt 0) { ([string]$args[0]).Trim() } else { "" }
if ($argument -in @("--help", "-h", "/?", "help")) {
  Show-Menu
  Show-Usage
  exit 0
}
if ($argument -ne "") {
  if ($argument -notin @("0", "1", "2", "3", "4", "5", "6", "7")) {
    Write-Host "未知参数：$argument" -ForegroundColor Red
    Show-Usage
    exit 1
  }
  try {
    Invoke-MenuChoice -Choice $argument
  } catch {
    Write-Host ""
    Write-Host "执行失败：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
  exit 0
}

while ($true) {
  Show-Menu
  $rawChoice = Read-Host "请输入数字"
  # 管道或 CI 用完输入流时 Read-Host 返回 $null；直接退出，避免 $null.Trim() 抛错。
  if ($null -eq $rawChoice) {
    Write-Host ""
    Write-Host "输入流已结束，退出菜单。" -ForegroundColor DarkGray
    exit 0
  }
  $choice = ([string]$rawChoice).Trim()

  # 单个动作抛异常时只报错并回到菜单，不把整个窗口带走。
  try {
    Invoke-MenuChoice -Choice $choice
  } catch {
    Write-Host ""
    Write-Host "执行失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host "已返回菜单，可重试或选 0 退出。" -ForegroundColor DarkGray
  }
}
