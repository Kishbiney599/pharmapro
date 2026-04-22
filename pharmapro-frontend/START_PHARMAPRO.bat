@echo off
title PharmaPro Enterprise - Development Launcher
color 0A
echo.
echo  ============================================
echo   PharmaPro Enterprise - Development Mode
echo  ============================================
echo.

REM Kill any existing node processes on port 4000
echo [1/3] Clearing port 4000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Start the backend in a new window
echo [2/3] Starting backend API server...
start "PharmaPro Backend" cmd /k "cd /d %~dp0pharmapro-backend && npm start"

REM Wait for backend to be ready
echo [3/3] Waiting for backend to start...
timeout /t 4 /nobreak >nul

REM Open in browser
echo.
echo  Opening PharmaPro in your browser...
start http://localhost:3000

echo.
echo  To run as desktop app instead, use:
echo  cd pharmapro-frontend ^&^& npm run electron-dev
echo.
echo  Backend is running in the other window.
echo  Close that window to stop the backend.
echo.
pause
