@echo off
rem Windows entry point: switch to the UTF-8 code page, then run scripts\lfaa.ps1.
rem Keep every "rem" line ASCII: cmd decodes the file with the code page that was active when
rem it opened it, so non-ASCII comments can be misread as commands when stdout is redirected.
rem Related: scripts\lfaa.ps1 (menu and actions) and package.json (script definitions).
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "MENU=%~dp0scripts\lfaa.ps1"
if not exist "%MENU%" (
    echo [错误] 找不到 scripts\lfaa.ps1，仓库可能不完整。
    pause
    endlocal & exit /b 1
)
if not exist "%~dp0package.json" (
    echo [错误] 当前目录不是 LFAA 仓库根：%~dp0
    pause
    endlocal & exit /b 1
)

rem Pass %* through unchanged: "lfaa.bat 2" runs one menu item then exits, "--help" prints usage.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%MENU%" %*
set "LFAA_EXIT=%ERRORLEVEL%"

rem Menu item 0 keeps a standalone window open (exit 88 is the agreed marker from the PowerShell side).
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

rem Pause only on failure so a double-clicked window stays readable; success leaves no empty window.
if not "%LFAA_EXIT%"=="0" pause
endlocal & exit /b %LFAA_EXIT%