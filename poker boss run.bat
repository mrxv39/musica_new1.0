@echo off
setlocal

cd /d "%~dp0"

echo ===============================
echo   POKER BOSS - RUN
echo ===============================

REM Abre dos ventanas: tests y tauri dev
start "Poker Boss - Tests" cmd /k "cd /d ""%~dp0"" && npm test"
start "Poker Boss - Tauri Dev" cmd /k "cd /d ""%~dp0"" && npm run tauri dev"

endlocal
