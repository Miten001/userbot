@echo off
title Triangle Breakout Auto Trader v2.1
cd /d "%~dp0"

echo.
echo  ==============================================
echo   TRIANGLE BREAKOUT AUTO TRADER  v2.1
echo   Made by @codex_here
echo  ==============================================
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
