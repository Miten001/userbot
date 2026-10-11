@echo off
rem ───────────────────────────────────────────────────────────────────────
rem  GhostShell — hardened Chromium launcher (Windows, double-click entry)
rem
rem  Just runs GhostShell.ps1 with a permissive execution policy for this
rem  one invocation, so you don't have to change your machine-wide policy.
rem ───────────────────────────────────────────────────────────────────────
setlocal
cd /d "%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  where pwsh >nul 2>nul
  if errorlevel 1 (
    echo.
    echo GhostShell needs PowerShell. It ships with every copy of Windows 7+.
    echo If it is missing, install PowerShell 7: https://aka.ms/powershell
    echo.
    pause
    exit /b 1
  )
  set "PS=pwsh"
) else (
  set "PS=powershell"
)

%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0GhostShell.ps1" %*

if errorlevel 1 (
  echo.
  echo GhostShell exited with an error. See the message above.
  pause
)
endlocal
