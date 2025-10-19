FROM node:18-slim

WORKDIR /app

# Install system dependencies required for sharp and other native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Rebuild sharp for the current platform
RUN yarn add sharp --ignore-engines --force

# Install ts-node globally for server
RUN yarn global add ts-node tsconfig-paths

# Copy application files
COPY . .

# Build Next.js frontend
RUN yarn build

# Expose ports (3000 for Next.js, 3001 for API, 3002 for Public API)
EXPOSE 3000 3001 3002

# Copy startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Start both services
CMD ["/app/docker-entrypoint.sh"]
