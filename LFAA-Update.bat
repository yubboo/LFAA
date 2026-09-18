@echo off
rem 文件：LFAA-Update.bat
rem 作用：Git 源码更新入口
rem 说明：调用 scripts\windows\lfaa-update.ps1；用于已 Clone 仓库的源码更新。
rem 注意：本 BAT 只做稳定入口，不承载复杂逻辑。
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lfaa-update.ps1"
exit /b %ERRORLEVEL%
