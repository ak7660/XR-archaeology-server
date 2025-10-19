#!/bin/sh
set -e

echo "🚀 Starting XR Archaeology Server..."

# Start FeathersJS API server in the background
echo "📡 Starting FeathersJS API server on port 3001..."
yarn server:start &
API_PID=$!

# Wait for API server to be ready
echo "⏳ Waiting for API server to initialize..."
sleep 5

# Start Next.js frontend
echo "🌐 Starting Next.js frontend on port 3000..."
yarn start &
NEXTJS_PID=$!

echo "✅ All services started!"
echo "   - Next.js Frontend: http://localhost:3000/admin"
echo "   - API Server: http://localhost:3001/api"
echo "   - Public API: http://localhost:3002/api"

# Function to handle shutdown
cleanup() {
    echo "⚠️  Shutting down services..."
    kill $API_PID $NEXTJS_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# Keep script running and wait for both processes
wait
