FROM python:3.12.8-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY gateway.py fixtures.json ./
RUN useradd -r -u 10001 appuser
USER appuser
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8081/health')"
CMD ["uvicorn", "gateway:app", "--host", "0.0.0.0", "--port", "8081"]
