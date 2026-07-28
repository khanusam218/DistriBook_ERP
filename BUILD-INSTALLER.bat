@echo off
title DistriBook ERP - Build Installer
echo ============================================
echo   DistriBook ERP - Installer Builder
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Installing Electron build tools...
call npm install
if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )

echo.
echo [2/4] Building frontend...
cd frontend
call npm install
call npm run build
if errorlevel 1 ( echo ERROR: Frontend build failed & pause & exit /b 1 )
cd ..

echo.
echo [3/4] Installing backend dependencies...
cd backend
call npm install
cd ..

echo.
echo [4/4] Building Windows installer...
call npm run dist
if errorlevel 1 ( echo ERROR: Build failed & pause & exit /b 1 )

echo.
echo ============================================
echo   SUCCESS! Installer created in:
echo   dist-installer\
echo ============================================
echo.
explorer dist-installer
pause
