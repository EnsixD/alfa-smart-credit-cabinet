#!/usr/bin/env sh
# Запуск всего проекта одной командой (macOS / Linux): ./start.sh
set -e
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Docker не найден: https://docs.docker.com/get-docker/"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker не запущен. Запустите Docker и повторите."; exit 1; }

[ -f .env ] || { cp .env.example .env; echo "Создан .env из .env.example"; }

echo "Сборка и запуск сервисов — первый раз это займёт несколько минут..."
docker compose up -d --build

echo "Жду готовности приложения..."
i=0
until curl -sf http://localhost:8080 >/dev/null && curl -sf http://localhost:8000/health >/dev/null; do
  i=$((i + 1))
  [ "$i" -gt 100 ] && { echo "Приложение не ответило за 5 минут. Логи: docker compose logs"; exit 1; }
  sleep 3
done

echo
echo "Готово!"
echo "  Сайт и кабинеты:   http://localhost:8080"
echo "  Документация API:  http://localhost:8000/docs"
echo "  Пароль демоаккаунтов: demo123"
echo "  Остановить: docker compose down"
(xdg-open http://localhost:8080 || open http://localhost:8080) >/dev/null 2>&1 || true
