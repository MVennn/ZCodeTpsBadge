@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
cd /d "%ROOT%"
"%NODE%" src\patch.mjs --apply %*
echo.
pause
endlocal
