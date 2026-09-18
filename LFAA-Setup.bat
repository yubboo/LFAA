@echo off
rem 文件：LFAA-Setup.bat
rem 作用：开发环境入口
rem 说明：调用 scripts\windows\lfaa-setup.ps1；用于依赖准备、Web 启动和检查。
rem 注意：本 BAT 只做稳定入口，不承载复杂逻辑。
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lfaa-setup.ps1"
exit /b %ERRORLEVEL%
