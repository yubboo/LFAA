# LFAA Windows 菜单入口：安装当前工作区依赖，并在应用入口就绪后启动 Web。
# 支持 `lfaa.bat`（菜单）、`lfaa.bat 2`（直接执行菜单项后退出）、`lfaa.bat --help`（用法）。
# 本文件必须保存为 UTF-8 with BOM：Windows PowerShell 5.1 读无 BOM 的 .ps1 会按系统 ANSI 解码，
# 中文注释可能被拆成会吞掉花括号的字节序列，导致整个脚本解析失败（.editorconfig 已按 .ps1 固定 BOM）。
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

# 计算字符串在控制台的显示宽度：中文/全角字符占两格，按字符数对齐会错位。
function Get-DisplayWidth {
  param(
    [string]$Text
  )

  $width = 0
  foreach ($ch in $Text.ToCharArray()) {
    if ([int]$ch -ge 0x1100) { $width += 2 } else { $width += 1 }
  }
  return $width
}

# 按显示宽度右侧补空格，让中英文混排的目录名/字段对齐。
function Format-Padded {
  param(
    [string]$Text,
    [int]$Width
  )

  $pad = $Width - (Get-DisplayWidth -Text $Text)
  if ($pad -lt 0) { $pad = 0 }
  return $Text + (" " * $pad)
}

# 打印带分隔线的阶段标题，让长流程的每一步都能一眼定位。
function Write-Section {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title
  )

  $ruleLength = [Math]::Max(4, 52 - (Get-DisplayWidth -Text $Title))
  Write-Host ""
  Write-Host "── $Title " -ForegroundColor Cyan -NoNewline
  Write-Host ("─" * $ruleLength) -ForegroundColor DarkGray
}

# 按展示粒度归组路径：packages/ 与 apps/ 精确到包目录，其余按第一段归档。
function Get-DisplayGroup {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $parts = @($Path.Replace('\', '/').Split('/') | Where-Object { $_ })
  if ($parts.Count -ge 3 -and ($parts[0] -eq 'packages' -or $parts[0] -eq 'apps')) {
    return "$($parts[0])/$($parts[1])/$($parts[2])"
  }
  if ($parts.Count -ge 2) { return $parts[0] }
  return "(仓库根)"
}

# 汇总本次暂存：文件数、增删行、按目录分组与改动最大的文件，供提交前预览。
function Get-StagedSummary {
  $numstat = @(& git diff --cached --numstat 2>$null)
  $statusLines = @(& git diff --cached --name-status 2>$null)

  $files = [System.Collections.Generic.List[object]]::new()
  foreach ($line in $numstat) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $cols = @($line.Split("`t"))
    if ($cols.Count -lt 3) { continue }
    $isBinary = ($cols[0] -eq '-')
    $added = if ($isBinary) { 0 } else { [int]$cols[0] }
    $removed = if ($isBinary) { 0 } else { [int]$cols[1] }
    $files.Add([pscustomobject]@{ Path = $cols[2]; Added = $added; Removed = $removed; Binary = $isBinary })
  }

  $counts = @{ Added = 0; Modified = 0; Deleted = 0; Renamed = 0; Other = 0 }
  foreach ($line in $statusLines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $status = [string]$line.Substring(0, 1)
    switch ($status) {
      "A" { $counts.Added++ }
      "M" { $counts.Modified++ }
      "D" { $counts.Deleted++ }
      "R" { $counts.Renamed++ }
      "C" { $counts.Renamed++ }
      default { $counts.Other++ }
    }
  }

  $groupMap = @{}
  foreach ($file in $files) {
    $name = Get-DisplayGroup -Path $file.Path
    if (-not $groupMap.ContainsKey($name)) {
      $groupMap[$name] = [pscustomobject]@{ Name = $name; Files = 0; Added = 0; Removed = 0 }
    }
    $entry = $groupMap[$name]
    $entry.Files++
    $entry.Added += $file.Added
    $entry.Removed += $file.Removed
  }
  $groups = @($groupMap.Values | Sort-Object -Property @{ Expression = { $_.Files }; Descending = $true }, Name)

  $topFiles = @($files | Sort-Object -Property @{ Expression = { $_.Added + $_.Removed }; Descending = $true } | Select-Object -First 3)

  # 空暂存时 Measure-Object 的 Sum 是 $null，直接格式化会打印空白，这里显式累加。
  $addedTotal = 0
  $removedTotal = 0
  foreach ($file in $files) {
    $addedTotal += $file.Added
    $removedTotal += $file.Removed
  }

  return [pscustomobject]@{
    Files = @($files)
    Counts = $counts
    Groups = $groups
    TopFiles = $topFiles
    Added = $addedTotal
    Removed = $removedTotal
  }
}

# 逐条列出待推送提交的哈希/标题/作者/时间；比一行 oneline 更适合推送前确认。
function Get-PendingCommitDetails {
  param(
    [string]$Range = "origin/main..HEAD"
  )

  $lines = @(& git -c i18n.logOutputEncoding=utf-8 log --pretty="%h|%s|%an|%ad" --date=format:"%Y-%m-%d %H:%M" $Range 2>$null)
  $details = @()
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $cols = @($line.Split("|"))
    if ($cols.Count -lt 4) { continue }
    $details += [pscustomobject]@{ Hash = $cols[0]; Subject = $cols[1]; Author = $cols[2]; Date = $cols[3] }
  }
  return $details
}

# 读取某个提交引用的短哈希；引用不存在时返回空串。
function Get-ShortRef {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Ref
  )

  $value = (& git rev-parse --short --verify --quiet $Ref 2>$null | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($value)) { return "" }
  return $value
}

# 解析「领先 / 落后」提交数：origin/main...HEAD 左侧是落后、右侧是领先。
function Get-SyncCounts {
  $output = (& git rev-list --left-right --count "origin/main...HEAD" 2>$null | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($output)) { return $null }
  $cols = @($output -split "\s+" | Where-Object { $_ })
  if ($cols.Count -lt 2) { return $null }
  return [pscustomobject]@{ Behind = [int]$cols[0]; Ahead = [int]$cols[1] }
}

# 统计工作区未提交项（含未跟踪文件），用于推送后确认是否干净。
function Get-WorktreeChangeCount {
  $lines = @(& git status --porcelain 2>$null | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  return $lines.Count
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

    $totalStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Section "1/6 暂存变更（遵循 .gitignore）"
    Write-Host "  正在暂存工作区变更..." -ForegroundColor DarkGray
    Invoke-Git -Arguments @("add", "-A")
    if ($script:GitExitCode -ne 0) {
      Write-Host "  git add 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
      return
    }

    # 提交前先让用户看清「这次到底要提交什么」，而不是只靠 git 那一行汇总。
    $staged = Get-StagedSummary
    $stagedCount = $staged.Files.Count
    if ($stagedCount -eq 0) {
      Write-Host "  暂存区没有新文件（工作区无改动，或改动全部被 .gitignore 忽略）" -ForegroundColor DarkGray
    } else {
      Write-Host ("  暂存 {0} 个文件：新增 {1} · 修改 {2} · 删除 {3} · 重命名 {4} · 其他 {5}" -f `
        $stagedCount, $staged.Counts.Added, $staged.Counts.Modified, $staged.Counts.Deleted, $staged.Counts.Renamed, $staged.Counts.Other)
      Write-Host ("  行数变化：+{0} −{1}" -f $staged.Added, $staged.Removed)

      if ($staged.Groups.Count -gt 0) {
        $nameWidth = 12
        foreach ($group in $staged.Groups) {
          $groupWidth = Get-DisplayWidth -Text $group.Name
          if ($groupWidth -gt $nameWidth) { $nameWidth = $groupWidth }
        }
        Write-Host "  按目录（最多列 6 组）：" -ForegroundColor DarkGray
        $shown = 0
        foreach ($group in $staged.Groups) {
          if ($shown -ge 6) { break }
          Write-Host ("    {0}  {1,3} 个文件   +{2} −{3}" -f (Format-Padded -Text $group.Name -Width $nameWidth), $group.Files, $group.Added, $group.Removed) -ForegroundColor DarkGray
          $shown++
        }
        if ($staged.Groups.Count -gt $shown) {
          Write-Host ("    …另有 {0} 个目录未展开" -f ($staged.Groups.Count - $shown)) -ForegroundColor DarkGray
        }
      }

      if ($staged.TopFiles.Count -gt 0) {
        Write-Host "  改动最大的文件：" -ForegroundColor DarkGray
        foreach ($file in $staged.TopFiles) {
          $size = if ($file.Binary) { "（二进制）" } else { "+{0} −{1}" -f $file.Added, $file.Removed }
          Write-Host ("    {0}  {1}" -f $file.Path, $size) -ForegroundColor DarkGray
        }
      }
    }

    Write-Section "2/6 安全检测"
    $safetyStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $safe = Test-PushSafety -Scope "staged"
    $safetyStopwatch.Stop()
    if (-not $safe) { return }
    Write-Host ("  扫描 {0} 个暂存文件（依赖/构建产物、敏感文件、>5MB 大文件、疑似明文密钥）：通过，0 命中（{1:0.0}s）" -f `
      $stagedCount, $safetyStopwatch.Elapsed.TotalSeconds) -ForegroundColor Green

    & git rev-parse --verify HEAD *> $null
    $hasHead = ($LASTEXITCODE -eq 0)
    $willCommit = (-not $hasHead) -or ($stagedCount -gt 0)

    $lastMsgFile = Join-Path $gitDir "lfaa-last-commit-msg.txt"
    $lastCommitMsg = Get-LastCommitMessage -LastMsgFile $lastMsgFile -HasHead $hasHead

    Write-Section "3/6 创建提交"
    if ($willCommit) {
      if (-not [string]::IsNullOrWhiteSpace($lastCommitMsg)) {
        Write-Host "  上次提交：$lastCommitMsg" -ForegroundColor Yellow
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

      Write-Host "  正在创建提交：$commitMsg" -ForegroundColor DarkGray
      Invoke-Git -Arguments @("commit", "-m", $commitMsg)
      if ($script:GitExitCode -ne 0) {
        Write-Host "  git commit 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
        # pre-commit 的空白检查最常见；把具体文件与行号直接打出来，省得自己去猜。
        $whitespace = (& git diff --cached --check 2>&1 | Out-String).Trim()
        if (-not [string]::IsNullOrWhiteSpace($whitespace)) {
          Write-Host "  暂存内容有空白问题（pre-commit 会拦下），位置：" -ForegroundColor Yellow
          $whitespace -split "`r?`n" | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
          Write-Host "  修好后重新运行菜单 4 / 5 即可；确认为误报再用 git commit --no-verify。" -ForegroundColor Yellow
        } else {
          Write-Host "  空白检查没问题，失败原因看上面的钩子输出。" -ForegroundColor DarkGray
        }
        return
      }
      [System.IO.File]::WriteAllText($lastMsgFile, $commitMsg, [System.Text.UTF8Encoding]::new($false))

      # 把刚创建的提交讲清楚：哈希、作者、时间、文件数与增删行。
      $commitInfo = (& git show -s --format="%H|%an|%ae|%cd" --date=format:"%Y-%m-%d %H:%M:%S" HEAD 2>$null | Out-String).Trim()
      $commitCols = @($commitInfo.Split("|"))
      if ($commitCols.Count -ge 4) {
        $shortHash = $commitCols[0].Substring(0, 7)
        Write-Host ("  ✔ 已创建提交 {0}「{1}」" -f $shortHash, $commitMsg) -ForegroundColor Green
        Write-Host ("    作者 {0} <{1}> · 时间 {2}" -f $commitCols[1], $commitCols[2], $commitCols[3]) -ForegroundColor DarkGray
        Write-Host ("    文件 {0} 个 · 行数 +{1} −{2}" -f $stagedCount, $staged.Added, $staged.Removed) -ForegroundColor DarkGray
      } else {
        Write-Host ("  ✔ 已创建提交：{0}" -f $commitMsg) -ForegroundColor Green
      }
    } else {
      if (-not [string]::IsNullOrWhiteSpace($lastCommitMsg)) {
        Write-Host "  跳过提交：当前 HEAD 已是「$lastCommitMsg」" -ForegroundColor DarkGray
      } else {
        Write-Host "  跳过提交：工作区没有可提交的改动" -ForegroundColor DarkGray
      }
    }

    Write-Section "4/6 复检与刷新远端"
    $trackedStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $trackedSafe = Test-PushSafety -Scope "tracked"
    $trackedStopwatch.Stop()
    if (-not $trackedSafe) { return }
    $trackedCount = @(& git ls-files 2>$null).Count
    Write-Host ("  复检 {0} 个已跟踪文件（防历史遗留的产物/密钥）：通过，0 命中（{1:0.0}s）" -f $trackedCount, $trackedStopwatch.Elapsed.TotalSeconds) -ForegroundColor Green

    # refs/remotes/origin/main 可能只是本地旧记录（换机、拷贝 .git、久未拉取都会留下过期值）：
    # 只按它判断「领先几个提交」会把已推送的提交再报一次，也会把真正落后的提交漏掉。
    # 推送本身就必须联网，所以先按远端真实值刷新一次引用，再算待推送提交。
    Write-Host "  正在刷新远端引用 origin/main..." -ForegroundColor DarkGray
    Invoke-Git -Arguments @("fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main")
    if ($script:GitExitCode -ne 0) {
      Write-Host "  刷新远端引用失败（离线、认证或仓库地址问题），下面按本地记录判断待推送提交。" -ForegroundColor Yellow
    }
    $remoteHeadBefore = Get-ShortRef "origin/main"
    if ([string]::IsNullOrWhiteSpace($remoteHeadBefore)) {
      Write-Host "  远端 origin/main：尚无记录（首次推送）" -ForegroundColor DarkGray
    } else {
      Write-Host ("  远端 origin/main：{0}" -f $remoteHeadBefore) -ForegroundColor DarkGray
    }

    # 把「到底推了什么」说清楚：菜单外的 git commit 也会在这里逐条列出，而不是只报一句「直接推送」。
    $pendingDetails = @(Get-PendingCommitDetails)
    $remoteRef = (& git rev-parse --verify --quiet "refs/remotes/origin/main" 2>$null | Out-String).Trim()
    $hasRemoteRef = -not [string]::IsNullOrWhiteSpace($remoteRef)
    if (-not $Force -and $hasRemoteRef -and $pendingDetails.Count -eq 0) {
      Write-Host "  本地已与 origin/main 同步，没有需要推送的提交。" -ForegroundColor Green
      return
    }

    $currentBranch = (& git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($currentBranch) -or $currentBranch -eq "HEAD") {
      $currentBranch = "main"
      & git branch -M main | Out-Null
    }

    Write-Section "5/6 推送"
    Write-Host ("  仓库：{0}" -f $remoteUrl) -ForegroundColor DarkGray
    Write-Host ("  分支：{0} -> main" -f $currentBranch) -ForegroundColor DarkGray
    if ($pendingDetails.Count -gt 0) {
      Write-Host ("  待推送 {0} 个提交：" -f $pendingDetails.Count) -ForegroundColor DarkGray
      foreach ($commit in $pendingDetails) {
        Write-Host ("    {0}  {1}" -f $commit.Hash, $commit.Subject)
        Write-Host ("           {0} · {1}" -f $commit.Author, $commit.Date) -ForegroundColor DarkGray
      }
    } elseif (-not $hasRemoteRef) {
      Write-Host "  远端还没有 main 分支，将推送当前分支的全部提交。" -ForegroundColor DarkGray
    }

    if ($Force) {
      # --force-with-lease：远端在我们上次拉取后被别人更新时先失败，避免误伤他人提交。
      Write-Host "  正在强制推送..." -ForegroundColor Yellow
      Invoke-Git -Arguments @("push", "--force-with-lease", "-u", "origin", "${currentBranch}:main")
      if ($script:GitExitCode -ne 0) {
        Write-Host "  强制推送被拒绝：远端可能已有新提交（这是 --force-with-lease 的保护）。" -ForegroundColor Yellow
        $overwrite = Read-Host "确认丢弃远端最新提交并覆盖吗？输入 yes 继续，回车取消"
        if ($overwrite.Trim() -eq "yes") {
          Invoke-Git -Arguments @("push", "--force", "-u", "origin", "${currentBranch}:main")
        } else {
          Write-Host "已取消强制推送。" -ForegroundColor DarkGray
          return
        }
      }
    } else {
      Write-Host "  正在推送..." -ForegroundColor DarkGray
      Invoke-Git -Arguments @("push", "-u", "origin", "${currentBranch}:main")
    }
    if ($script:GitExitCode -eq 0) {
      Write-Section "6/6 结果"
      $remoteHeadAfter = Get-ShortRef "origin/main"
      if (-not [string]::IsNullOrWhiteSpace($remoteHeadBefore) -and -not [string]::IsNullOrWhiteSpace($remoteHeadAfter)) {
        Write-Host ("  origin/main：{0} → {1}" -f $remoteHeadBefore, $remoteHeadAfter) -ForegroundColor Green
      } elseif (-not [string]::IsNullOrWhiteSpace($remoteHeadAfter)) {
        Write-Host ("  origin/main：{0}" -f $remoteHeadAfter) -ForegroundColor Green
      }
      $sync = Get-SyncCounts
      if ($null -ne $sync) {
        Write-Host ("  同步状态：领先 {0} 个提交 / 落后 {1} 个提交" -f $sync.Ahead, $sync.Behind) -ForegroundColor Green
      }
      $worktreeChanges = Get-WorktreeChangeCount
      if ($worktreeChanges -eq 0) {
        Write-Host "  工作区：干净" -ForegroundColor Green
      } else {
        Write-Host ("  工作区：仍有 {0} 项未提交（多为构建产物或本地配置）" -f $worktreeChanges) -ForegroundColor Yellow
      }
      if ($Force) {
        Write-Host "  ✔ 强制推送成功：$remoteUrl (main)" -ForegroundColor Green
      } else {
        Write-Host "  ✔ 推送成功：$remoteUrl (main)" -ForegroundColor Green
      }
      $totalStopwatch.Stop()
      Write-Host ("  总用时：{0:0.0}s" -f $totalStopwatch.Elapsed.TotalSeconds) -ForegroundColor DarkGray
    } else {
      if ($Force) {
        Write-Host "  强制推送失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
      } else {
        Write-Host "  推送失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
        # 最常见的失败是「远端有本地没有的提交」，普通推送不会覆盖，直接给出三条出路。
        Write-Host "  常见原因：远端分支上还有你本地没有的提交。可以这样处理：" -ForegroundColor Yellow
        Write-Host "    · 选 5 强制覆盖远端（会丢弃远端那些提交，先确认它们不是你要保留的）" -ForegroundColor DarkGray
        Write-Host "    · 选 6 先拉取并整合远端改动，再回来推送" -ForegroundColor DarkGray
        Write-Host "    · 或者保留两边历史，推成新分支：git push origin main:lfaa-app" -ForegroundColor DarkGray
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

# 结束正在运行的 LFAA 桌面端（Electron 壳与桌面宿主），避免单实例锁与固定端口把新实例挡在外面。
function Stop-LfaaDesktopProcesses {
  $desktopDir = Join-Path $repoRoot "apps\desktop"
  $hostDir = Join-Path $repoRoot "apps\desktop-host"
  $targets = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe' OR Name='LFAA.exe'" -ErrorAction SilentlyContinue | Where-Object {
      $commandLine = $_.CommandLine
      if (-not $commandLine) { return $false }
      $commandLine.IndexOf($desktopDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $commandLine.IndexOf($hostDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    })
  if ($targets.Count -eq 0) { return }
  foreach ($target in $targets) {
    Write-Host "结束旧的 LFAA 桌面端进程：$($target.Name)（PID $($target.ProcessId)）..." -ForegroundColor Cyan
    Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
  }
  # 等旧进程真正退出，单实例锁与文件句柄才会释放。
  Start-Sleep -Milliseconds 1000
}

# 桌面端固定占用 5173：启动前结束该端口的监听进程，并等端口真正释放后再交给桌面宿主。
function Clear-DesktopHostPort {
  param([int]$Port = 5173)
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) {
    Write-Host "端口 $Port 空闲，桌面端将固定监听该端口。" -ForegroundColor DarkGray
    return $true
  }
  $occupantId = $listener.OwningProcess
  if (-not $occupantId -or $occupantId -le 4) {
    Write-Host "端口 $Port 被系统进程占用（PID $occupantId），无法自动释放。" -ForegroundColor Red
    return $false
  }
  $occupant = Get-CimInstance Win32_Process -Filter "ProcessId=$occupantId" -ErrorAction SilentlyContinue
  $occupantName = if ($occupant) { $occupant.Name } else { "未知进程" }
  Write-Host "端口 $Port 被占用：$occupantName（PID $occupantId），正在结束占用进程..." -ForegroundColor Yellow
  Stop-Process -Id $occupantId -Force -ErrorAction SilentlyContinue
  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    Start-Sleep -Milliseconds 200
    if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) {
      Write-Host "端口 $Port 已释放。" -ForegroundColor Green
      return $true
    }
  }
  Write-Host "端口 $Port 仍被占用，桌面端未启动。" -ForegroundColor Red
  return $false
}

# 菜单渲染独立成函数：一次性执行带编号参数时不需要打印菜单。
function Show-Menu {
  $branch = ''
  $sync = '未设置上游'
  $dirty = 0
  try {
    $current = (& git rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($current)) {
      $branch = $current.Trim()
      $upstream = (& git rev-parse --abbrev-ref "$branch@{upstream}" 2>$null)
      if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($upstream)) {
        $counts = (& git rev-list --left-right --count "$($upstream.Trim())...$branch" 2>$null)
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($counts)) {
          $parts = $counts.Trim() -split '\s+'
          if ([int]$parts[0] -eq 0 -and [int]$parts[1] -eq 0) {
            $sync = '已同步'
          } else {
            $sync = "落后 $($parts[0]) / 领先 $($parts[1])"
          }
        }
      }
      # 用 -uall 逐个文件计数：默认模式把未跟踪目录折叠成一行，一旦 git add 展开，
      # 同一批改动会从「未提交 224 项」突然变成「未提交 861 项」，看起来像凭空多出文件。
      $dirty = (& git status --porcelain --untracked-files=all | Measure-Object).Count
    }
  } catch {
    # 非 git 环境不显示状态行，不影响菜单使用。
  }

  $line = '=' * 52
  Write-Host ""
  Write-Host $line -ForegroundColor DarkCyan
  Write-Host "  LFAA 控制台" -ForegroundColor Cyan
  Write-Host "  仓库：$repoRoot" -ForegroundColor DarkGray
  if ($branch -ne '') {
    $dirtyText = ""
    if ($dirty -gt 0) { $dirtyText = " · 未提交 $dirty 项" }
    Write-Host "  分支：$branch · $sync$dirtyText" -ForegroundColor DarkGray
  }
  Write-Host $line -ForegroundColor DarkCyan

  Write-Host ""
  Write-Host "【依赖与运行】" -ForegroundColor Yellow
  Write-Host "  1   安装依赖（pnpm install，一键下载缺失依赖）"
  Write-Host "  2   启动 Web（缺依赖才补装 → 构建 → 5173 重启并自动打开浏览器）"
  Write-Host ""
  Write-Host "【桌面端】" -ForegroundColor Yellow
  Write-Host "  3   启动桌面端（独立随机端口，不与 Web 5173 冲突）"
  Write-Host "  7   构建桌面端安装包（NSIS + 免安装 zip → build/）"
  Write-Host ""
  Write-Host "【GitHub 同步 · yubboo/LFAA】" -ForegroundColor Yellow
  Write-Host "  4   提交并推送（普通推送 + 安全检测）"
  Write-Host "  5   强制推送（覆盖远端，需输入确认）"
  Write-Host "  6   拉取远端最新源码（预览提交 + 确认）"
  Write-Host ""
  Write-Host "【退出】" -ForegroundColor Yellow
  Write-Host "  0   退出菜单（保留终端窗口）"
  Write-Host ""
  Write-Host "用法：lfaa.bat [0-7] 直接执行一项后退出；lfaa.bat --help 看说明。" -ForegroundColor DarkGray
}

# 执行一个菜单项。所有动作都在这里收敛，异常由调用方捕获，菜单不会因为单个动作失败而退出。
function Invoke-MenuChoice {
  param([string]$Choice)

  switch ($Choice) {
    "1" {
      Clear-StalePnpmTempDirs
      Invoke-Pnpm -Arguments @("install")
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

      # 启动前仅释放被 Web 占用的 5173~5177 端口；桌面端已走独立端口，互不干扰。
      Stop-LfaaWebListeners

      # 依赖状态检查成功后才启动，避免把依赖错误隐藏为服务启动失败。
      # 首次运行会在这里自动装齐依赖；日常启动只补装新增/缺失的包，不会重下已装依赖。
      & node (Join-Path $PSScriptRoot "ensure-dependencies.mjs")
      $exitCode = $LASTEXITCODE
      if ($exitCode -eq 0) {
        Write-Host "启动完成后会自动用默认浏览器打开本地地址（默认 http://127.0.0.1:5173/ ）。" -ForegroundColor DarkGray
        # --open 由 apps/cli 透传给 @lfaa/web-server，Vite 监听成功后打开默认浏览器。
        Invoke-Pnpm -Arguments @("lfaa", "web", "--open")
        $exitCode = $script:PnpmExitCode
      } else {
        Write-Host "依赖检查或安装失败，未启动 Web。" -ForegroundColor Red
      }
      if ($exitCode -ne 0) {
        Write-Host "LFAA Web 启动失败，退出码：$exitCode" -ForegroundColor Red
      }
    }
    "3" {
      # 桌面端依赖 packages/lib、Web 产物与桌面主进程/Preload/宿主入口；缺失时自动补全依赖并增量构建。
      & node (Join-Path $PSScriptRoot "ensure-dependencies.mjs")
      if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖检查或安装失败，未启动桌面端。" -ForegroundColor Red
        return
      }
      $desktopEntry = Join-Path $repoRoot "apps/desktop/dist/main.cjs"
      $desktopPreload = Join-Path $repoRoot "apps/desktop/dist/preload.cjs"
      $desktopHostLib = Join-Path $repoRoot "apps/desktop-host/lib/index.js"
      $webDist = Join-Path $repoRoot "apps/web/dist/index.html"
      $hostLib = Join-Path $repoRoot "packages/host/web-server/lib/index.js"
      if (-not (Test-Path -LiteralPath $webDist) -or -not (Test-Path -LiteralPath $hostLib)) {
        Write-Host "正在构建工作区库与 Web 产物..." -ForegroundColor Cyan
        Invoke-Pnpm -Arguments @("build")
        if ($script:PnpmExitCode -ne 0) {
          Write-Host "工作区构建失败，退出码：$($script:PnpmExitCode)" -ForegroundColor Red
          return
        }
      }
      if (-not (Test-Path -LiteralPath $desktopEntry) -or -not (Test-Path -LiteralPath $desktopPreload) -or -not (Test-Path -LiteralPath $desktopHostLib)) {
        Write-Host "正在构建桌面端主进程与宿主入口..." -ForegroundColor Cyan
        Invoke-Pnpm -Arguments @("build:desktop:app")
        if ($script:PnpmExitCode -ne 0) {
          Write-Host "桌面端构建失败，退出码：$($script:PnpmExitCode)" -ForegroundColor Red
          return
        }
      }
      # 启动前只结束旧的本仓库桌面端实例（释放单实例锁），不再抢占或误杀 Web 5173。
      Stop-LfaaDesktopProcesses
      Invoke-Pnpm -Arguments @("desktop")
      if ($script:PnpmExitCode -ne 0) {
        Write-Host "LFAA 桌面端启动失败，退出码：$($script:PnpmExitCode)" -ForegroundColor Red
      }
    }
    "7" {
      Write-Host "开始构建桌面端安装包（产物输出至 build/，全量构建 + staging + NSIS，通常需要几分钟）..." -ForegroundColor Cyan
      Invoke-Pnpm -Arguments @("build:desktop")
      if ($script:PnpmExitCode -eq 0) {
        $releaseDir = Join-Path $repoRoot "build"
        Write-Host "桌面端安装包已生成：$releaseDir" -ForegroundColor Green
        Get-ChildItem -LiteralPath $releaseDir -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @(".exe", ".zip") } | ForEach-Object {
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
  Write-Host ""
  Write-Host "菜单项说明：" -ForegroundColor Yellow
  Write-Host "  1  安装依赖：在仓库根执行 pnpm install，只补缺失的包"
  Write-Host "  2  启动 Web：缺依赖才补装 → 构建 → 5173 重启并自动打开浏览器"
  Write-Host "  3  启动桌面端：独立随机端口，不占用 Web 的 5173"
  Write-Host "  7  构建桌面端安装包：NSIS 安装包 + 免安装 zip 输出到 build/"
  Write-Host "  4  提交并推送：暂存明细 → 安全检测（产物/敏感文件/大文件/密钥）→ 创建提交 → 刷新远端 → 推送 → 结果摘要"
  Write-Host "  5  强制推送：覆盖远端 main（--force-with-lease 先保护，确认后要求输入 yes）"
  Write-Host "  6  拉取远端：预览远端提交并确认后快进合并，必要时用 stash 暂存本地改动"
  Write-Host "  0  退出菜单（保留终端窗口）"
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
