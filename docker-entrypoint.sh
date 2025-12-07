#!/bin/sh
set -e

echo "🚀 Starting XR Archaeology Server..."

# Railway port configuration:
# - API domain (xr-archaeology-server-production.up.railway.app) -> Port 9000
# - Frontend domain (www.veditourism.com) -> Port 8080

# Debug: Print environment variables
echo "📋 Environment check:"
echo "   PORT_API=${PORT_API:-not set}"
echo "   PORT=${PORT:-not set}"

# Start FeathersJS API server in the background
# PORT_API, PORT_PUBLIC, PORT_INTERNAL will be read from env or config.json
echo "📡 Starting FeathersJS API server..."
yarn server:start &
API_PID=$!

# Wait for API server to be ready
echo "⏳ Waiting for API server to initialize..."
sleep 5

# Start Next.js frontend
# Next.js uses PORT env variable
echo "🌐 Starting Next.js frontend..."
yarn start &
NEXTJS_PID=$!

echo "✅ All services started!"

# Function to handle shutdown
cleanup() {
    echo "⚠️  Shutting down services..."
    kill $API_PID $NEXTJS_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# Keep script running and wait for both processes
wait
