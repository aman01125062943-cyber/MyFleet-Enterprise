# ===========================================
# Stage 1: Build React App
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install git needed for some dependencies
RUN apk add --no-cache git

# Install dependencies for both root and whatsapp-service
COPY package*.json ./
RUN npm install

COPY whatsapp-service/package*.json ./whatsapp-service/
RUN cd whatsapp-service && npm install

# Copy source and prepare for build
COPY . .

# Accept Supabase environment variables for Vite build
# Accept Supabase environment variables for Vite build
ARG VITE_SUPABASE_URL="https://necqtqhmnmcsjxcxgeff.supabase.co"
ARG VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY3F0cWhtbm1jc2p4Y3hnZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODg1NTUsImV4cCI6MjA4NDk2NDU1NX0.vpSOLJbEN1JrASDLiZ1G6-yT_QUZo0JzEDKefKANAaQ"

# Write to .env.production
RUN echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" >> .env.production
RUN echo "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" >> .env.production

# Continue setup

RUN npm run build

# ===========================================
# Stage 2: Production Server (Node.js)
# ===========================================
FROM node:20-alpine

WORKDIR /app

# Install git and build tools needed for native dependencies (like libsignal)
RUN apk add --no-cache git python3 make g++

# Copy the built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy the whatsapp-service source code into its own directory
COPY whatsapp-service/ ./whatsapp-service/

# Set working directory to whatsapp-service for running the server
WORKDIR /app/whatsapp-service

# Install production dependencies
RUN npm install --omit=dev

# Expose the WhatsApp service port
EXPOSE 3002

# The server.js in whatsapp-service already serves ../dist
CMD ["node", "server.js"]




