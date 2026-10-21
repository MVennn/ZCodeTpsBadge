@echo off
setlocal
set "ROOT=%~dp0"
set "CFG=%ROOT%..\config.local.json"

if defined ZCODE_EXE goto have_exe
if exist "%CFG%" (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content -Raw '%CFG%' | ConvertFrom-Json).zcodeExe"`) do set "ZCODE_EXE=%%i"
)
if not defined ZCODE_EXE set "ZCODE_EXE=%LOCALAPPDATA%\Programs\ZCode\ZCode.exe"
:have_exe

if not exist "%ZCODE_EXE%" (
  echo ZCode.exe not found: %ZCODE_EXE%
  echo Set ZCODE_EXE or config.local.json.
  pause
  exit /b 1
)

tasklist /FI "IMAGENAME eq ZCode.exe" 2>nul | findstr /I "ZCode.exe" >nul
if not errorlevel 1 (
  echo ZCode is already running. Quit it completely from the tray first.
  pause
  exit /b 1
)

start "" /min node "%ROOT%injector.mjs" 9222
start "" "%ZCODE_EXE%" --remote-debugging-port=9222
endlocal
