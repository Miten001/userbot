@echo off
REM ====================================================
REM   TRIANGLE BREAKOUT AUTO TRADER  -  Windows Launcher
REM   Made by @codex_here
REM ====================================================
REM
REM Double-click this file to run the bot.
REM The window will stay open even if there is an error,
REM so you can read what went wrong.

title Triangle Breakout Auto Trader v2.0

echo.
echo  Starting Triangle Breakout Auto Trader...
echo.

REM Try "py" launcher first (most reliable on Windows), fall back to "python"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py "%~dp0triangle_scanner.py"
) else (
    python "%~dp0triangle_scanner.py"
)

echo.
echo ============================================================
echo   Bot stopped. Press any key to close this window.
echo ============================================================
pause >nul
