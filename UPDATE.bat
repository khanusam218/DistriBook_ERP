@echo off
title DistriBook ERP - Update
echo ========================================
echo   DistriBook ERP - Updater
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

:: Fetch latest code without merging yet
git fetch origin main
if errorlevel 1 (
    echo.
    echo ERROR: Could not fetch updates. Check your internet connection.
    pause
    exit /b 1
)

:: Checkout only non-database files from the latest version
for /f "delims=" %%F in ('git diff --name-only HEAD origin/main') do (
    echo %%F | findstr /i "\.db$" >nul
    if errorlevel 1 (
        git checkout origin/main -- "%%F" >nul 2>&1
    )
)

:: Mark branch as up to date
git merge -X ours origin/main >nul 2>&1

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
