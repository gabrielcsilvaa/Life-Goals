FROM python:3.12.12-slim-bookworm@sha256:593bd06efe90efa80dc4eee3948be7c0fde4134606dd40d8dd8dbcade98e669c
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.production_settings
WORKDIR /app
COPY backend/requirements.lock /tmp/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r /tmp/requirements.lock && useradd --uid 10001 --create-home app
COPY --chown=app:app backend /app
USER 10001
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--no-proxy-headers"]
