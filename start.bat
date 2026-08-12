@echo off
title Zodiac Arena - Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [!] Khong tim thay Node.js.
  echo       Cai ban LTS tai https://nodejs.org roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

echo.
echo   Dang khoi dong Zodiac Arena...
echo   Ctrl+C de dung server.
echo.
node server.js
echo.
echo   Server da dung.
pause
