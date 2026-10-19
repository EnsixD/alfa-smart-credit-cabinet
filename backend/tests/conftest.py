import os
import socket
import sys
import tempfile
import threading
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_db = Path(tempfile.mkdtemp()) / "test.db"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


PORT = _free_port()
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_db.as_posix()}",
    "MOCK_GATEWAY_URL": f"http://127.0.0.1:{PORT}",
    "PIPELINE_STEP_DELAY_S": "0",
    "INLINE_PIPELINE": "true",
    "SEED_ON_START": "true",
    "INTEGRATION_RETRIES": "0",
})


@pytest.fixture(scope="session", autouse=True)
def mock_gateway():
    import uvicorn
    sys.path.insert(0, str(ROOT / "mock-gateway"))
    import gateway  # noqa: E402

    server = uvicorn.Server(uvicorn.Config(gateway.app, host="127.0.0.1", port=PORT, log_level="warning"))
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(50):
        if server.started:
            break
        time.sleep(0.1)
    yield gateway
    server.should_exit = True


@pytest.fixture(scope="session")
def client(mock_gateway):
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as c:
        yield c


def login(client, name: str) -> dict:
    r = client.post("/api/auth/login", json={"login": name, "password": "demo123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
