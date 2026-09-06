# Multi-stage build for Next.js + Python

# Stage 1: Build Next.js app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Stage 2: Production runtime
FROM node:18-alpine AS runner

WORKDIR /app

# Install Python for backend API
RUN apk add --no-cache python3 py3-pip tzdata

# Copy built app from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Copy public folder if it exists (create empty one if not)
RUN mkdir -p ./public
COPY --from=builder /app/public ./public 2>/dev/null || true

# Copy Python API scripts
COPY api ./api

# Copy database
COPY silver.db ./silver.db

# Install Python dependencies
RUN pip3 install --break-system-packages --no-cache-dir yfinance pandas numpy

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]
