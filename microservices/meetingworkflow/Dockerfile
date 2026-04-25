# Python FastAPI application - Meeting Workflow
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1

# Copy requirements
COPY requirements.txt .

# Install Python dependencies without bytecode compilation
RUN pip install --no-cache-dir --no-compile -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8001/health')" || exit 1

# Run application with gunicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
