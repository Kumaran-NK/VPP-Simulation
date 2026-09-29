# VPP Server Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy VPP environment files
COPY server/ ./server/
COPY models.py ./
COPY client.py ./
COPY baseline_inference.py ./
COPY inference.py ./
COPY requirements.txt ./
COPY openenv.yaml ./
COPY pyproject.toml ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:7860/health')"

# Run the VPP server
CMD ["python", "-m", "server.app", "--host", "0.0.0.0", "--port", "7860"]
