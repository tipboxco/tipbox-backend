@echo off
echo Starting Tipbox Development Servers...
echo.

:: Backend servisini yeni pencerede başlat
echo Starting Backend...
start "Tipbox Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Catalog Service'i yeni pencerede başlat
echo Starting Catalog Service...
start "Tipbox Catalog Service" cmd /k "cd /d %~dp0catalog-service && npm run dev"

echo.
echo Both services are starting in separate windows.
echo Press any key to exit this window...
pause >nul

