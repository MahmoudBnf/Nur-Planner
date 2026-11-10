@echo off
REM One-click start for Windows: installs if needed, builds if needed, starts the server.
cd /d "%~dp0"
title Nur Planner

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies ^(first run^)...
  call npm install || goto :fail
)

REM Always rebuild the UI (takes a few seconds), so code changes are picked up.
echo Building the UI...
call npm run build || goto :fail

if "%PORT%"=="" set PORT=4000
REM Open the browser two seconds after the server starts.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"
call npm start
goto :eof

:fail
echo Something went wrong. See the messages above.
pause
