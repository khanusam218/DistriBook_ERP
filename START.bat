@echo off
title Thok Software ERP
echo ========================================
echo   Thok Software ERP - Starting...
echo ========================================
echo.

:: Start backend
echo [1/2] Starting Backend (API Server)...
cd /d "%~dp0backend"
start "Thok Backend" cmd /k "node src/server.js"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend
echo [2/2] Starting Frontend...
cd /d "%~dp0frontend"
start "Thok Frontend" cmd /k "npm run dev"

:: Wait then open browser
timeout /t 4 /nobreak >nul
echo.
echo ========================================
echo   Opening browser at http://localhost:3000
echo   Login: admin / admin123
echo ========================================
start http://localhost:3000
