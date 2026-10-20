@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Собирает архив для загрузки на платформу из последнего коммита (без node_modules, .venv, баз и PDF кейса)
for /f %%h in ('git rev-parse --short HEAD') do set HASH=%%h
git archive --format=zip --prefix=vektor-credit-cabinet/ -o "vektor-credit-cabinet-%HASH%.zip" HEAD
if errorlevel 1 (echo Не удалось собрать архив & pause & exit /b 1)
for %%f in ("vektor-credit-cabinet-%HASH%.zip") do echo Готово: %%~nxf, %%~zf байт (лимит платформы — 18 МБ)
pause
