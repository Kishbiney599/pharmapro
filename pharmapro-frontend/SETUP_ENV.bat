@echo off
title PharmaPro Enterprise - Database Setup
color 0A
echo.
echo  ============================================================
echo   PharmaPro Enterprise - One-Time Database Setup
echo  ============================================================
echo.
echo  This will configure your MySQL database connection.
echo.

set /p DB_HOST=MySQL Host (press Enter for localhost): 
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT=MySQL Port (press Enter for 3306): 
if "%DB_PORT%"=="" set DB_PORT=3306

set /p DB_USER=MySQL Username (press Enter for root): 
if "%DB_USER%"=="" set DB_USER=root

set /p "DB_PASS=MySQL Password: "

set /p DB_NAME=Database Name (press Enter for pharmapro): 
if "%DB_NAME%"=="" set DB_NAME=pharmapro

set /p "PHARM_NAME=Pharmacy Name (e.g. Kumasi Central Pharmacy): "

echo.

REM Find the backend .env location
set ENV_FILE=%~dp0resources\backend\.env

(
echo DB_HOST=%DB_HOST%
echo DB_PORT=%DB_PORT%
echo DB_USER=%DB_USER%
echo DB_PASSWORD=%DB_PASS%
echo DB_NAME=%DB_NAME%
echo JWT_SECRET=pharmapro_stiles_tech_2025_enterprise_secret
echo PORT=4000
echo PHARMACY_NAME=%PHARM_NAME%
) > "%ENV_FILE%"

if exist "%ENV_FILE%" (
  echo  ============================================================
  echo   SUCCESS! Database configured.
  echo  ============================================================
  echo.
  echo  You can now open PharmaPro Enterprise normally.
  echo.
) else (
  echo  ERROR: Could not write config file.
  echo  Try running this file as Administrator.
  echo.
  echo  Or manually create this file:
  echo  %ENV_FILE%
)

echo.
pause
