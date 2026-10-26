@echo off
title Wang Yunkang Portfolio - Offline Viewer
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Wang Yunkang - Architecture Portfolio
echo   Offline Viewer  (no internet needed)
echo  ==========================================
echo.

rem Prefer the portable build; fall back to dist.
set "SITE=%~dp0dist-open"
if not exist "%SITE%\index.html" set "SITE=%~dp0dist"
if not exist "%SITE%\index.html" (
  echo  [ERROR] No build found.
  echo          Run "pnpm build" first.
  pause
  exit /b 1
)

set "PORT=5280"

rem Bundled Python is the simplest static server and needs no dependencies.
set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" (
  where python >nul 2>&1 && set "PY=python"
)

rem Fallback: bundled Node + vite preview
set "NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
set "VITE=%~dp0node_modules\vite\bin\vite.js"

echo  Serving : %SITE%
echo  Address : http://127.0.0.1:%PORT%/
echo.
echo  This works with no internet connection.
echo  Close this window to stop.
echo  ------------------------------------------
echo.

start "" http://127.0.0.1:%PORT%/

if exist "%PY%" (
  rem --directory makes the site folder the server root, so paths resolve.
  "%PY%" -m http.server %PORT% --bind 127.0.0.1 --directory "%SITE%"
) else (
  echo  [info] Python not found, falling back to vite preview...
  "%NODE%" "%VITE%" preview --port %PORT% --strictPort
)

echo.
echo  Server stopped.
pause
