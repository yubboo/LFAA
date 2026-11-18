@echo off
rem Windows 双击入口：启动 scripts/lfaa.ps1 的本地菜单，并处理菜单退出状态。
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\lfaa.ps1"
set "LFAA_EXIT=%ERRORLEVEL%"
if "%LFAA_EXIT%"=="88" (
    echo %cmdcmdline% | find /i "/c" >nul
    if not errorlevel 1 (
        endlocal
        cd /d "%~dp0"
        cmd /k
        exit /b 0
    )
    endlocal & exit /b 0
)
endlocal & exit /b %LFAA_EXIT%
