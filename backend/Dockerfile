FROM python:3.10-slim

WORKDIR /app

# Copy requirements
COPY backend/requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy VPP project files (models, client, etc.)
COPY *.py ./
COPY server ./server

# Copy simulation server
COPY backend/simulation_server.py .

# Expose port
EXPOSE 8001

# Run simulation server
CMD ["python", "simulation_server.py"]
