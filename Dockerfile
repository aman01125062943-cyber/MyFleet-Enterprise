# ===========================================
# Stage 1: Build React App
# ===========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install git and build tools needed for native dependencies during npm install
RUN apk add --no-cache git python3 make g++ libc6-compat

# Install dependencies for both root and whatsapp-service
COPY package*.json ./
RUN npm ci

COPY whatsapp-service/package*.json ./whatsapp-service/
RUN cd whatsapp-service && npm ci

# Copy source and prepare for build
COPY . .

# Accept Supabase environment variables for Vite build
ARG VITE_SUPABASE_URL="https://necqtqhmnmcsjxcxgeff.supabase.co"
ARG VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ"

# Export as ENV so Vite build-time script can see them
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Write to .env.production
RUN echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" > .env.production
RUN echo "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" >> .env.production

# Continue setup

RUN npx vite build

# ===========================================
# Stage 2: Production Server (Node.js)
# ===========================================
FROM node:22-alpine

WORKDIR /app

# Install git and build tools needed for native dependencies (like libsignal)
RUN apk add --no-cache git python3 make g++ libc6-compat

# Copy the built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy the whatsapp-service source code into its own directory
COPY whatsapp-service/ ./whatsapp-service/

# Set working directory to whatsapp-service for running the server
WORKDIR /app/whatsapp-service

# Install production dependencies
RUN npm ci --omit=dev

# Expose the WhatsApp service port
EXPOSE 3002

# The server.js in whatsapp-service already serves ../dist
CMD ["node", "server.js"]




