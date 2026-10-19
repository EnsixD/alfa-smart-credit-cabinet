"""Клиенты внешних источников (ЕГРЮЛ/ЕГРИП, ФНС «Прозрачный бизнес», БКИ).

В прототипе все они смоделированы сервисом mock-gateway. Клиент реализует
таймаут, повторы с экспоненциальной задержкой и простой circuit breaker,
чтобы сбой внешней системы не ронял конвейер, а переводил заявку на ручную проверку.
"""

import logging
import time

import httpx

from .config import get_settings

log = logging.getLogger("integrations")


class IntegrationUnavailable(Exception):
    pass


class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown_s: float = 30):
        self.threshold, self.cooldown_s = threshold, cooldown_s
        self.failures, self.opened_at = 0, 0.0

    def allow(self) -> bool:
        if self.failures < self.threshold:
            return True
        if time.monotonic() - self.opened_at > self.cooldown_s:
            self.failures = self.threshold - 1  # half-open: одна пробная попытка
            return True
        return False

    def success(self) -> None:
        self.failures = 0

    def failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = time.monotonic()


_breakers: dict[str, CircuitBreaker] = {}


def call(source: str, path: str) -> dict:
    s = get_settings()
    br = _breakers.setdefault(source, CircuitBreaker())
    if not br.allow():
        raise IntegrationUnavailable(f"{source}: circuit open")
    last: Exception | None = None
    for attempt in range(s.integration_retries + 1):
        try:
            r = httpx.get(f"{s.mock_gateway_url}{path}", timeout=s.integration_timeout_s)
            if r.status_code == 404:
                br.success()
                return {"found": False}
            r.raise_for_status()
            br.success()
            return r.json()
        except (httpx.HTTPError, ValueError) as e:
            last = e
            log.warning("integration %s attempt %s failed: %s", source, attempt + 1, e)
            time.sleep(0.3 * 2**attempt)
    br.failure()
    raise IntegrationUnavailable(f"{source}: {last}")


def egrul(inn: str) -> dict:
    return call("EGRUL", f"/egrul/{inn}")


def fns(inn: str) -> dict:
    return call("FNS", f"/fns/transparent-business/{inn}")


def bki(inn: str) -> dict:
    return call("BKI", f"/bki/report/{inn}")


def _post(source: str, path: str, body: dict) -> dict:
    s = get_settings()
    r = httpx.post(f"{s.mock_gateway_url}{path}", json=body, timeout=s.integration_timeout_s)
    r.raise_for_status()
    return r.json()


def disburse(inn: str, amount: float, reference: str) -> dict:
    """Платёжный шлюз (смоделирован): зачисление кредита на расчётный счёт."""
    try:
        return _post("PAYMENTS", "/payments/disburse", {"inn": inn, "amount": amount, "reference": reference})
    except httpx.HTTPError as e:
        raise IntegrationUnavailable(f"PAYMENTS: {e}") from e


def faults() -> dict:
    return call("GATEWAY", "/admin/faults")


def set_fault(service: str, mode: str) -> dict:
    return _post("GATEWAY", "/admin/faults", {"service": service, "mode": mode})
