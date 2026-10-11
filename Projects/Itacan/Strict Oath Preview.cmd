@echo off
setlocal
set "ITACAN_PREVIEW_ROOT=%~dp0..\.."
set "ELECTRON_RUN_AS_NODE=1"
powershell.exe -NoProfile -NonInteractive -Command "$root=[IO.Path]::GetFullPath($env:ITACAN_PREVIEW_ROOT); $plugin=Join-Path $root '.obsidian\plugins\hub-project-menu'; $exe=Join-Path $plugin 'lib\atlas\tests\native\node_modules\electron\dist\electron.exe'; $launcher=Join-Path $plugin 'lib\tests\oath-host\launch.cjs'; Start-Process -FilePath $exe -ArgumentList ('\"'+$launcher+'\" --strict-preview') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'itacan-oath-preview.log') -RedirectStandardError (Join-Path $env:TEMP 'itacan-oath-preview-errors.log')"
endlocal
