@echo off
rem ============================================================
rem  Start the portfolio site in a HIDDEN background process.
rem
rem  Why this file exists:
rem    A plain console-based server (python -m http.server,
rem    vite preview) is a CHILD of the window that started it.
rem    Close that window and Windows kills the child too, so the
rem    port stops listening and the browser gets "can't connect".
rem
rem    This launcher hands the server to WScript.Shell with a
rem    hidden window and returns immediately, so the server is
rem    detached from any visible console.
rem
rem  Usage:
rem    start-background.cmd          start (does nothing if already running)
rem    start-background.cmd stop     stop it
rem ============================================================
setlocal
cd /d "%~dp0"

set "PORT=5280"
set "PY=C:\Users\wangyunkang\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY=python"

set "SITE=%~dp0dist-open"
if not exist "%SITE%\index.html" set "SITE=%~dp0dist"

if /i "%~1"=="stop" goto :stop

rem ---- already running? ----
netstat -ano | findstr /r /c:"LISTENING" | findstr /c:":%PORT% " >nul 2>&1
if not errorlevel 1 (
  echo Already running on port %PORT%.
  echo   http://127.0.0.1:%PORT%/
  goto :eof
)

if not exist "%SITE%\index.html" (
  echo [ERROR] No build found. Run "pnpm build" first.
  exit /b 1
)

rem ---- launch hidden, then return ----
set "VBS=%TEMP%\wyk-serve-%PORT%.vbs"
> "%VBS%" echo Set sh = CreateObject("WScript.Shell")
>>"%VBS%" echo sh.CurrentDirectory = "%SITE%"
>>"%VBS%" echo sh.Run """%PY%"" -m http.server %PORT% --bind 127.0.0.1 --directory ""%SITE%""", 0, False

cscript //nologo "%VBS%" >nul
del "%VBS%" >nul 2>&1

rem wait for the port to come up
for /l %%i in (1,1,20) do (
  netstat -ano | findstr /c:":%PORT% " | findstr /c:"LISTENING" >nul 2>&1
  if not errorlevel 1 goto :up
  ping -n 1 -w 300 127.0.0.1 >nul
)
echo [WARN] Started but port %PORT% is not listening yet.
goto :eof

:up
echo Started in background on port %PORT%.
echo   http://127.0.0.1:%PORT%/
echo.
echo It keeps running after this window closes.
echo To stop it:  start-background.cmd stop
goto :eof

:stop
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr /c:"LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1 && echo Stopped PID %%a
  set "FOUND=1"
)
if not defined FOUND echo Nothing was listening on port %PORT%.
goto :eof
