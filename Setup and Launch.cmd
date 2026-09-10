@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build
if errorlevel 1 exit /b 1
node scripts\launch.mjs
