@echo off
setlocal
cd /d "%~dp0"
title FORMANT installer
echo FORMANT installer
where node >nul 2>&1
if errorlevel 1 (
  where winget >nul 2>&1
  if errorlevel 1 ( echo Node.js 22.12+ is required: https://nodejs.org & pause & exit /b 1 )
  winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-source-agreements --accept-package-agreements
  if errorlevel 1 exit /b 1
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
call npm ci
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
node scripts\launch.mjs
echo FORMANT is ready at http://127.0.0.1:4317
pause
