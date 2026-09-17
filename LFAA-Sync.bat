@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lfaa-sync.ps1"
set "RC=%ERRORLEVEL%"
echo.
pause >nul
exit /b %RC%
