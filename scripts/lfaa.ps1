# LFAA Windows 菜单入口：安装当前工作区依赖，并在应用入口就绪后启动 Web。
$ErrorActionPreference = "Stop"
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

# 读取上一次通过菜单提交（或仓库最新一次提交）的 commit 信息。
function Get-LastCommitMessage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LastMsgFile,
    [Parameter(Mandatory = $true)]
    [bool]$HasHead
  )

  if (Test-Path -LiteralPath $LastMsgFile) {
    $saved = [System.IO.File]::ReadAllText($LastMsgFile, [System.Text.UTF8Encoding]::new($false)).Trim()
    if (-not [string]::IsNullOrWhiteSpace($saved)) {
      return $saved
    }
  }

  if ($HasHead) {
    $latest = (& git -c i18n.logOutputEncoding=utf-8 log -1 --pretty=%s 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($latest)) {
      return $latest
    }
  }

  return ""
}

# 一键初始化/关联 GitHub 远程仓库并推送当前工作区全部内容；通过 -Force 切换普通推送或强制推送。
function Push-ToGitHub {
  param(
    [switch]$Force
  )

  $remoteUrl = "https://github.com/yubboo/LFAA.git"
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "未找到 git，请先安装 Git。" -ForegroundColor Red
    return
  }

  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $gitDir = Join-Path $repoRoot ".git"
    if (-not (Test-Path -LiteralPath $gitDir)) {
      Write-Host "当前目录尚未初始化 Git 仓库，正在初始化 main 分支..." -ForegroundColor Cyan
      Invoke-Git -Arguments @("init", "-b", "main")
      if ($script:GitExitCode -ne 0) {
        Invoke-Git -Arguments @("init")
        if ($script:GitExitCode -ne 0) {
          Write-Host "git init 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
          return
        }
        & git checkout -B main | Out-Null
      }
    }

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

    $existingOrigin = (& git remote get-url origin 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($existingOrigin)) {
      Invoke-Git -Arguments @("remote", "add", "origin", $remoteUrl)
      if ($script:GitExitCode -ne 0) { return }
    } elseif ($existingOrigin -ne $remoteUrl) {
      Invoke-Git -Arguments @("remote", "set-url", "origin", $remoteUrl)
      if ($script:GitExitCode -ne 0) { return }
    }

    Write-Host "正在暂存工作区变更（遵循 .gitignore）..." -ForegroundColor Cyan
    Invoke-Git -Arguments @("add", "-A")
    if ($script:GitExitCode -ne 0) {
      Write-Host "git add 失败，退出码：$($script:GitExitCode)" -ForegroundColor Red
      return
    }

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
        return
      }
      [System.IO.File]::WriteAllText($lastMsgFile, $commitMsg, [System.Text.UTF8Encoding]::new($false))
    } else {
      if (-not [string]::IsNullOrWhiteSpace($lastCommitMsg)) {
        Write-Host "上次提交的信息是：$lastCommitMsg" -ForegroundColor Yellow
      }
      if ($Force) {
        Write-Host "工作区无新改动，直接强制推送当前提交。" -ForegroundColor DarkGray
      } else {
        Write-Host "工作区无新改动，直接推送当前提交。" -ForegroundColor DarkGray
      }
    }

    $currentBranch = (& git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($currentBranch) -or $currentBranch -eq "HEAD") {
      $currentBranch = "main"
      & git branch -M main | Out-Null
    }

    if ($Force) {
      Write-Host "正在强制推送到 $remoteUrl（${currentBranch} -> main）..." -ForegroundColor Yellow
      Invoke-Git -Arguments @("push", "--force", "-u", "origin", "${currentBranch}:main")
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
      }
    }
  } finally {
    $ErrorActionPreference = $prevErrorAction
  }
}

while ($true) {
  Write-Host ""
  Write-Host "========== LFAA ==========" -ForegroundColor Cyan
  Write-Host "1. 安装依赖（pnpm install --prefer-offline）"
  Write-Host "2. 启动 Web（pnpm lfaa web）"
  Write-Host "4. 一键推送到 GitHub（https://github.com/yubboo/LFAA.git）"
  Write-Host "5. 一键强制推送到 GitHub（https://github.com/yubboo/LFAA.git）"
  Write-Host "0. 退出"
  $choice = Read-Host "请输入数字"

  switch ($choice) {
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
        continue
      }

      if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "未找到 Node.js，无法检查依赖。" -ForegroundColor Red
        continue
      }

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
    "4" {
      Push-ToGitHub
    }
    "5" {
      Push-ToGitHub -Force
    }
    "0" { exit 0 }
    default { Write-Host "无效选项，请输入 1、2、4、5 或 0。" -ForegroundColor Yellow }
  }
}
