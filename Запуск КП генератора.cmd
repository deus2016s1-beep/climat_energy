@echo off
setlocal
set "APP_DIR=%~dp0"
set "APP_FILE=%APP_DIR%index.html"
set "APP_URL="

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$u = [System.Uri](Resolve-Path '%APP_FILE%'); $u.AbsoluteUri"`) do set "APP_URL=%%I"
if not defined APP_URL (
  echo Не удалось сформировать путь к index.html
  start "KP Generator" "%APP_FILE%"
  exit /b
)

REM Запуск в режиме "приложения" (без адресной строки/вкладок)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "KP Generator" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%"
  exit /b
)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "KP Generator" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%"
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "KP Generator" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
  exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "KP Generator" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
  exit /b
)

REM Фолбэк — обычное открытие файла
start "KP Generator" "%APP_FILE%"
