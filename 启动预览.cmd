@echo off
title Wang Yunkang Portfolio - Local Preview
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Wang Yunkang - Architecture Portfolio
echo   Local Preview
echo  ==========================================
echo.

rem Use the bundled Node runtime so a system-wide install is not required.
set "NODE=C:\Users\wangyunkang\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
set "VITE=%~dp0node_modules\vite\bin\vite.js"

if not exist "%NODE%" (
  echo  [ERROR] Node runtime not found:
  echo          %NODE%
  echo.
  echo  Edit the NODE= line in this file to point at your node.exe
  pause
  exit /b 1
)

if not exist "%VITE%" (
  echo  [ERROR] Vite not found. Run "pnpm install" in this folder first.
  pause
  exit /b 1
)

if not exist "%~dp0dist\index.html" (
  echo  [info] No production build yet - building now...
  "%NODE%" "%VITE%" build
  echo.
)

rem Detect the LAN IPv4 so a phone on the same Wi-Fi can connect.
set "LANIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined LANIP set "LANIP=%%a"
)
set "LANIP=%LANIP: =%"

echo  On this computer:
echo     http://127.0.0.1:5274/
echo.
if defined LANIP (
  echo  On your phone ^(same Wi-Fi^):
  echo     http://%LANIP%:5274/
  echo.
  echo  If the phone cannot connect, allow Node.js through the
  echo  Windows Firewall and tick "Private networks".
  echo.
)
echo  Close this window to stop the server.
echo  ------------------------------------------
echo.

start "" http://127.0.0.1:5274/
"%NODE%" "%VITE%" preview --port 5274 --strictPort

echo.
echo  Server stopped.
pause
