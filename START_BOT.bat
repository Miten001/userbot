@echo off
title Triangle Bot v3.0 - anony_v1
color 0B
cd /d "%~dp0"

echo.
echo ============================================================
echo            anony_v1  -  Triangle Bot v3.0
echo                  Made by @codex_here
echo ============================================================
echo.
echo  Forex  -  Crypto  -  Gold  -  Silver
echo  Auto-Detect MT5  ^|  Auto Trade  ^|  Trail SL
echo.
echo ============================================================
echo.
echo  IMPORTANT - Yeh checklist confirm karo:
echo.
echo    [1]  MT5 terminal OPEN hai aur LOGIN ho chuki hai
echo    [2]  AlgoTrading button GREEN hai (toolbar)
echo    [3]  Tools ^> Options ^> Allow algorithmic trading TICK
echo    [4]  19 symbols Market Watch mein add hai
echo.
echo ============================================================
echo.
echo  Bot start ho raha hai... 5 second mein...
echo.

timeout /t 5 /nobreak >nul

python triangle_bot_v3.0_PROTECTED.py

echo.
echo ============================================================
echo  Bot band ho gaya. Window 30 second mein close hogi.
echo ============================================================
timeout /t 30 /nobreak >nul
