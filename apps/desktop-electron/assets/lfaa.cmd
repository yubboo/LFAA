@echo off
setlocal DisableDelayedExpansion
"%~dp0..\resources\app-runtime\node.exe" "%~dp0..\resources\app-runtime\apps\cli\bin\lfaa.mjs" %*
exit /b %errorlevel%
