@echo off
title Triangle Bot - Diagnostic
echo.
echo  Running diagnostic checks...
echo.
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py "%~dp0diagnose.py"
) else (
    python "%~dp0diagnose.py"
)
echo.
echo ============================================================
echo   Diagnostic finished. Press any key to close.
echo ============================================================
pause >nul
