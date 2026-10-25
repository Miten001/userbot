@echo off
title VVIP MUSIC BOT - Installer
echo ============================================
echo   VVIP MUSIC BOT - WINDOWS INSTALLER
echo ============================================
echo.
echo [1/3] Python packages install ho rahe hain...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install fail hua!
    echo Agar tgcrypto error de to install karo "Microsoft Visual C++ Build Tools"
    echo ya command: python -m pip install pyrofork pytgcalls yt-dlp python-dotenv requests aiohttp Pillow
    pause
    exit /b 1
)
echo.
echo [2/3] FFMPEG check kar raha hoon...
ffmpeg -version >nul 2>nul
if errorlevel 1 (
    echo.
    echo  WARNING: ffmpeg install nahi hai!
    echo  Ye link se download karo: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
    echo  Zip extract kar ke uske `bin` folder ka path PATH environment me add karo
    echo  Ya `ffmpeg.exe` ko is musicbot folder me hi daal do.
    echo.
    echo  Readme padho step-by-step guide ke liye.
    echo.
)
echo.
echo [3/3] Installation complete!
echo ============================================
echo  Bot chalaane ke liye start.bat double-click karo
echo ============================================
pause
