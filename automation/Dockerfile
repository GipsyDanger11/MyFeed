FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for cryptography wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY automation/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY automation/ ./automation/
COPY supabase/schema.sql ./supabase_schema.sql

EXPOSE 8000
CMD ["uvicorn", "automation.app:app", "--host", "0.0.0.0", "--port", "8000"]
