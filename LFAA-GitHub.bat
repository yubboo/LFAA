@echo off
rem 文件：LFAA-GitHub.bat
rem 作用：GitHub 推送入口
rem 说明：调用 scripts\windows\lfaa-github.ps1；用于状态、origin、Commit 和 Push。
rem 注意：本 BAT 只做稳定入口，不承载复杂逻辑。
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lfaa-github.ps1"
exit /b %ERRORLEVEL%
