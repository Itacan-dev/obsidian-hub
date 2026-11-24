@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Follow "Run and build from source" in the Itacan README to install the Windows development dependencies.
  pause
  exit /b 1
)
set "ELECTRON_RUN_AS_NODE="
start "" "node_modules\electron\dist\electron.exe" "." --itacan-dev %*
