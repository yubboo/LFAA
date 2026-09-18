@echo off
rem 文件：LFAA-Sync.bat
rem 作用：稳定工作区同步入口
rem 说明：调用 scripts\windows\lfaa-sync.ps1；用于预览/执行版本包到稳定工作区的同步。
rem 注意：本 BAT 只做稳定入口，不承载复杂逻辑。
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lfaa-sync.ps1"
exit /b %ERRORLEVEL%
