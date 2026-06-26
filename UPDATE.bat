@echo off
title Thok Software - Update
echo ========================================
echo   Thok Software ERP - Updater
echo ========================================
echo.

:: Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [1/4] Fetching latest updates from server...
cd /d "%~dp0"
git pull origin main
if errorlevel 1 (
    echo.
    echo ERROR: Could not fetch updates. Check your internet connection.
    pause
    exit /b 1
)

echo.
echo [2/4] Updating backend packages...
cd /d "%~dp0backend"
npm install --silent
if errorlevel 1 (
    echo ERROR: Backend package update failed.
    pause
    exit /b 1
)

echo.
echo [3/4] Updating frontend packages...
cd /d "%~dp0frontend"
npm install --silent
if errorlevel 1 (
    echo ERROR: Frontend package update failed.
    pause
    exit /b 1
)

echo.
echo [4/4] Update complete!
echo ========================================
echo   All updates applied successfully.
echo   Please restart the software using START.bat
echo ========================================
echo.
set /p restart="Start the software now? (Y/N): "
if /i "%restart%"=="Y" (
    cd /d "%~dp0"
    call START.bat
)
