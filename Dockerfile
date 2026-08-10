# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:18-bullseye AS builder

# Install build dependencies for node-gyp and native modules (node-pty)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install all dependencies without running lifecycle postinstall hooks prematurely
RUN npm install --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run dist

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:18-bullseye-slim

# Install runtime dependencies and build tools for native modules (node-pty)
RUN apt-get update && apt-get install -y --no-install-recommends \
    android-tools-adb \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./

# Install production dependencies
RUN npm install --omit=dev --ignore-scripts

EXPOSE 8000
#EXPOSE 5037 <--- not needed anymore, the architecture we are aiming is: 
#                              Debian/Ubuntu HOST
#                     ┌─────────────────────────┐
#                     │                         │
#  USB ──────────────►│ ADB server :5037       │
#                     │                         │
#                     │  10HC6K05U20001G       │
#                     │  2c39d81f               │
#                     └────────────┬────────────┘
#                                  │
#                          172.20.0.1:5037
#                                  │
#                   ┌──────────────┴──────────────┐
#                   │                             │
#            ws-scrcpy                       allocation-backend
#            adbkit                          adbkit
#            :8000                           :4000
#                   │                             │
#                   └─────────── same ADB ────────┘

# Start ADB server listening on 0.0.0.0 so allocation-backend can share it, then start ws-scrcpy
#CMD ["sh", "-c", "adb -a -P 5037 server nodaemon & sleep 1 && npm start"]
# Approved ADB Architecture:
#                     USB
#                      │
#              ┌───────▼────────┐
#              │   Ubuntu host  │
#              │                │
#              │ ADB server     │
#              │ 0.0.0.0:5037   │
#              │                │
#              │  ┌──────────┐  │
#              │  │ phones   │  │
#              │  └──────────┘  │
#              └───────┬────────┘
#                      │ Docker network
#           ┌──────────┴──────────┐
#           │                     │
#    ws-scrcpy                backend
#    ADB_HOST=host.docker...  ADB_SERVER_SOCKET=
#    ADB_PORT=5037            tcp:host.docker...:5037

CMD ["npm", "start"]