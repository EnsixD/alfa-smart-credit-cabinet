@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Вектор — запуск

echo.
echo   Вектор · кредитный кабинет для бизнеса
echo   ---------------------------------------
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [!] Docker не найден. Установите Docker Desktop: https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [..] Docker не запущен — открываю Docker Desktop...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  for /l %%i in (1,1,60) do (
    docker info >nul 2>&1 && goto docker_ready
    timeout /t 3 /nobreak >nul
  )
  echo [!] Docker так и не запустился. Запустите Docker Desktop вручную и повторите.
  pause
  exit /b 1
)
:docker_ready
echo [ok] Docker работает

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [ok] Создан .env из .env.example
)

echo [..] Сборка и запуск сервисов — первый раз это займёт несколько минут...
docker compose up -d --build
if errorlevel 1 (
  echo [!] Не удалось запустить сервисы. Подробности выше.
  pause
  exit /b 1
)

echo [..] Жду готовности приложения...
for /l %%i in (1,1,100) do (
  curl -sf http://localhost:8080 >nul 2>&1 && curl -sf http://localhost:8000/health >nul 2>&1 && goto app_ready
  timeout /t 3 /nobreak >nul
)
echo [!] Приложение не ответило за 5 минут. Логи: docker compose logs
pause
exit /b 1

:app_ready
echo.
echo   Готово!
echo   Сайт и кабинеты:   http://localhost:8080
echo   Документация API:  http://localhost:8000/docs
echo   Демоаккаунты: кнопка «Открыть демоверсию» на странице входа, пароль demo123
echo   Остановить: stop.bat
echo.
start "" http://localhost:8080
pause
