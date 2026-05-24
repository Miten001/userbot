@echo off
REM ====================================================
REM   TRIANGLE BREAKOUT - HISTORICAL BACKTESTER
REM   Made by @codex_here
REM
REM   Pre-requisites:
REM     1. Run triangle_scanner.py once (saves credentials)
REM     2. Open MT5 terminal so it can serve historical data
REM ====================================================

title Triangle Breakout - Backtester

echo.
echo  Starting historical backtester...
echo  This will fetch candle data for 19 pairs x 3 timeframes.
echo  Please wait, it may take 1-3 minutes.
echo.

where py >nul 2>nul
if %ERRORLEVEL%==0 (
    py "%~dp0backtest.py"
) else (
    python "%~dp0backtest.py"
)

echo.
echo ============================================================
echo   Backtest finished. Press any key to close this window.
echo ============================================================
pause >nul
