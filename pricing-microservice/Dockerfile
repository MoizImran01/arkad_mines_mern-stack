FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default for local runs; Render (and similar) override PORT at runtime.
ENV PORT=5001
EXPOSE 5001

# JSON CMD does not expand env vars — use shell so $PORT is applied.
# Single worker fits Render free tier memory better than multiple workers.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 1 --timeout 120 app:app"]
