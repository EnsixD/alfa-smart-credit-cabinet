@echo off
chcp 65001 >nul
cd /d "%~dp0"
docker compose down
echo Сервисы остановлены. Данные сохранены в Docker volume.
pause
