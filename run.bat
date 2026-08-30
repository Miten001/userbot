@echo off
title Triangle Breakout Auto Trader v2.3
cd /d "%~dp0"

echo.
echo  ==============================================
echo   TRIANGLE BREAKOUT AUTO TRADER  v2.3
echo   Auto-Detect MT5 (no saved credentials)
echo   Made by @codex_here
echo  ==============================================
echo.
echo  Make sure MT5 terminal is OPEN and LOGGED IN
echo  before this script tries to attach to it.
echo.

REM Try python launcher first, fall back to plain "python"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py -3 triangle_scanner.py
) else (
    python triangle_scanner.py
)

echo.
echo  Press any key to close...
pause >nul
