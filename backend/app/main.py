import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import func, text

from .config import get_settings
from .db import SessionLocal, init_db
from .models import Application, Job
from .routers import applications, bank, common
from .state_machine import TransitionError

logging.basicConfig(level=logging.INFO,
                    format='{"ts":"%(asctime)s","lvl":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')
log = logging.getLogger("api")

app = FastAPI(
    title="Умный кредитный кабинет предпринимателя — API",
    version="1.0.0",
    description="Цифровой кредитный конвейер для малого и микробизнеса: кабинет клиента, конвейер обработки "
                "заявки, рабочее место кредитного специалиста. Внешние системы смоделированы сервисом mock-gateway.",
)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins.split(","), allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(common.router)
app.include_router(applications.router)
app.include_router(bank.router)

_requests = {"total": 0, "errors": 0}


@app.middleware("http")
async def access_log(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    _requests["total"] += 1
    if response.status_code >= 500:
        _requests["errors"] += 1
    if not request.url.path.endswith("/stream"):
        # в логах только метод, путь и статус — без тела запроса и персональных данных
        log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - start) * 1000)
    return response


@app.exception_handler(TransitionError)
async def transition_error(_: Request, exc: TransitionError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.on_event("startup")
def startup() -> None:
    for attempt in range(30):  # ждём, пока поднимется Postgres
        try:
            init_db()
            break
        except Exception as e:  # noqa: BLE001
            log.warning("DB not ready (%s), retry %s", e, attempt)
            time.sleep(2)
    if get_settings().seed_on_start:
        from .seed import seed
        seed()


@app.get("/health", tags=["ops"])
def health():
    with SessionLocal() as db:
        db.execute(text("select 1"))
    return {"status": "ok"}


@app.get("/metrics", tags=["ops"], response_class=PlainTextResponse, summary="Метрики в формате Prometheus")
def metrics():
    with SessionLocal() as db:
        apps = db.query(Application.status, func.count()).group_by(Application.status).all()
        jobs = db.query(Job.status, func.count()).group_by(Job.status).all()
    lines = [f"http_requests_total {_requests['total']}", f"http_errors_total {_requests['errors']}"]
    lines += [f'applications_total{{status="{s}"}} {c}' for s, c in apps]
    lines += [f'pipeline_jobs_total{{status="{s}"}} {c}' for s, c in jobs]
    return "\n".join(lines) + "\n"
