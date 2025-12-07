#!/bin/sh
set -e

echo "🚀 Starting XR Archaeology Server..."

# Railway port configuration:
# - API domain (xr-archaeology-server-production.up.railway.app) -> Port 9000
# - Frontend domain (www.veditourism.com) -> Port 8080

# Set ports from environment or use defaults
API_PORT="${PORT_API:-9000}"
NEXTJS_PORT="${PORT:-8080}"

echo "📡 Starting FeathersJS API server on port ${API_PORT}..."
PORT_API=${API_PORT} PORT_PUBLIC=-1 PORT_INTERNAL=-1 yarn server:start &
API_PID=$!

# Wait for API server to be ready
echo "⏳ Waiting for API server to initialize..."
sleep 5

# Start Next.js frontend
echo "🌐 Starting Next.js frontend on port ${NEXTJS_PORT}..."
PORT=${NEXTJS_PORT} yarn start &
NEXTJS_PID=$!

echo "✅ All services started!"
echo "   - Next.js Frontend: http://localhost:${NEXTJS_PORT}/admin"
echo "   - API Server: http://localhost:${API_PORT}/api"

# Function to handle shutdown
cleanup() {
    echo "⚠️  Shutting down services..."
    kill $API_PID $NEXTJS_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# Keep script running and wait for both processes
wait
