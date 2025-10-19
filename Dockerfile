FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy application files
COPY . .

# Build the application
RUN yarn build

# Expose ports
EXPOSE 3000 3001 3002

# Start both API server and Next.js
CMD ["sh", "-c", "node server/index.js & yarn start"]
