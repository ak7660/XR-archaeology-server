#!/bin/bash
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

echo "✅ All services started! (api=$API_PID next=$NEXTJS_PID)"

SHUTTING_DOWN=0

# Function to handle shutdown
cleanup() {
    SHUTTING_DOWN=1
    echo "⚠️  Shutting down services..."
    kill "$API_PID" "$NEXTJS_PID" 2>/dev/null || true
    wait "$API_PID" "$NEXTJS_PID" 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# Wait for the FIRST process to exit, not for both.
#
# A bare `wait` only returns once *every* child has exited, so a dead API left
# the container running with just Next.js. The platform still saw a listening
# port on :8080 and reported the service healthy, while :9000 was gone and the
# mobile app got 502s - an outage with no failing healthcheck and no restart.
# That happened in production on 2026-08-31.
#
# `wait -n` returns as soon as either child exits, so we can bring the whole
# container down and let Railway's restart policy replace it with a clean one.
#
# NOTE: `wait -n` is a bash builtin and is NOT supported by dash, which is what
# /bin/sh points at on this image - hence the #!/bin/bash shebang above.
if wait -n; then
    EXIT_CODE=0
else
    EXIT_CODE=$?
fi

# A signal handler already ran and owns the exit status.
if [ "$SHUTTING_DOWN" -eq 1 ]; then
    exit 0
fi

if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "❌ FeathersJS API server exited (code ${EXIT_CODE})."
else
    echo "❌ Next.js frontend exited (code ${EXIT_CODE})."
fi
echo "   Stopping the container so Railway restarts it with both services."

# Take the surviving process down too so the container exits promptly.
kill "$API_PID" "$NEXTJS_PID" 2>/dev/null || true
wait "$API_PID" "$NEXTJS_PID" 2>/dev/null || true

# Must be non-zero, otherwise restartPolicyType=ON_FAILURE will not restart us.
if [ "$EXIT_CODE" -eq 0 ]; then
    EXIT_CODE=1
fi

exit "$EXIT_CODE"
