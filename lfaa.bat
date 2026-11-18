@echo off
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
