#!/bin/bash

# VPP 3D Simulation - Development Quick Start Script
# This script starts all three services in separate terminal tabs

set -e

echo "🚀 VPP 3D Orchestrator - Starting All Services..."
echo "=================================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Function to start service in new terminal tab
start_service() {
    local name=$1
    local command=$2
    local port=$3
    
    echo -e "${BLUE}Starting $name on port $port...${NC}"
    
    # Platform-specific terminal opening
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && $command\""
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux (try common terminals)
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal --tab -- bash -c "cd $(pwd) && $command; exec bash"
        elif command -v konsole &> /dev/null; then
            konsole --new-tab -e bash -c "cd $(pwd) && $command; exec bash"
        elif command -v xterm &> /dev/null; then
            xterm -e "cd $(pwd) && $command; exec bash" &
        else
            echo "Please run manually: $command"
        fi
    else
        echo "Platform not supported for auto-start. Please run manually:"
        echo "  $command"
    fi
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"

# Check ports
echo -e "${BLUE}Checking ports...${NC}"
check_port 7860 || echo "  VPP server may need to be stopped"
check_port 8001 || echo "  Simulation server may need to be stopped"
check_port 3000 || echo "  Frontend may need to be stopped"

# Determine VPP project path
VPP_PROJECT_PATH="${VPP_PROJECT_PATH:-.}"

if [ ! -f "$VPP_PROJECT_PATH/server/app.py" ]; then
    echo -e "${YELLOW}⚠️  VPP project not found at $VPP_PROJECT_PATH${NC}"
    echo "Please set VPP_PROJECT_PATH environment variable:"
    echo "  export VPP_PROJECT_PATH=/path/to/vpp-env"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "backend/venv" ]; then
    echo -e "${BLUE}Creating Python virtual environment...${NC}"
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
    cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}Installing Node.js dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Start services
echo ""
echo -e "${GREEN}Starting services...${NC}"
echo "This will open new terminal tabs/windows for each service."
echo ""

# Service 1: VPP OpenEnv Server
start_service "VPP Server" \
    "cd $VPP_PROJECT_PATH && uvicorn server.app:app --host 0.0.0.0 --port 7860" \
    7860

sleep 2

# Service 2: Simulation WebSocket Server
start_service "Simulation Server" \
    "cd $(pwd)/backend && source venv/bin/activate && python simulation_server.py" \
    8001

sleep 2

# Service 3: Frontend
start_service "Frontend" \
    "cd $(pwd)/frontend && npm run dev" \
    3000

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Services:"
echo "  1. VPP Server:        http://localhost:7860"
echo "  2. Simulation Server: ws://localhost:8001"
echo "  3. Frontend:          http://localhost:3000"
echo ""
echo -e "${BLUE}Open your browser to: ${GREEN}http://localhost:3000${NC}"
echo ""
echo "Press Ctrl+C in each terminal to stop services"

# Optional: Wait for services to be ready
echo ""
echo -e "${BLUE}Waiting for services to be ready...${NC}"

# Wait for VPP server
for i in {1..30}; do
    if curl -s http://localhost:7860/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ VPP Server ready${NC}"
        break
    fi
    sleep 1
done

# Wait for Simulation server
for i in {1..30}; do
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Simulation Server ready${NC}"
        break
    fi
    sleep 1
done

# Wait for Frontend
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend ready${NC}"
        break
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}🎉 All services are ready!${NC}"
echo -e "${BLUE}Opening browser...${NC}"

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
elif command -v open &> /dev/null; then
    open http://localhost:3000
else
    echo "Please open http://localhost:3000 manually"
fi
