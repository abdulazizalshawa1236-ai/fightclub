@echo off
chcp 65001 >nul
title Fight Club Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js غير مثبت. نزّله من https://nodejs.org ^(نسخة LTS^) ثم شغّل الملف مرة ثانية.
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%i in ('node --version') do set NODE_MAJOR=%%i
if %NODE_MAJOR% LSS 22 (
  echo [X] هذا الموقع يحتاج Node.js 22 أو أحدث. نزّل نسخة LTS من https://nodejs.org ثم أعد المحاولة.
  pause
  exit /b 1
)

if not exist node_modules (
  echo جارٍ تثبيت المكتبات ^(مرة واحدة فقط^)...
  call npm install --omit=dev --cache .npm-cache
  if errorlevel 1 ( echo [X] فشل التثبيت - تأكد من الإنترنت & pause & exit /b 1 )
)

if not exist .env (
  if exist data\club.db (
    > .env echo PORT=3000
    >> .env echo ADMIN_USER=admin
    >> .env echo TZ_NAME=Asia/Riyadh
  ) else (
    echo.
    echo أول تشغيل: اختر اسم المستخدم وكلمة المرور لحساب الأدمن
    set /p AUSER=اسم المستخدم [admin]: 
    if "%AUSER%"=="" set AUSER=admin
    set /p APASS=كلمة المرور ^(12 حرفاً على الأقل، واتركها فارغة لتوليد كلمة عشوائية^): 
    > .env echo PORT=3000
    >> .env echo ADMIN_USER=%AUSER%
    >> .env echo ADMIN_PASS=%APASS%
    >> .env echo TZ_NAME=Asia/Riyadh
  )
)

echo.
echo الموقع:        http://localhost:3000
echo لوحة التحكم:   http://localhost:3000/admin
echo ^(لا تغلق هذه النافذة طالما تريد الموقع شغّال - للإيقاف اضغط Ctrl+C^)
echo.
start "" "http://localhost:3000/admin"
node server.js
pause
