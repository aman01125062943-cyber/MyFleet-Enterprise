# ===========================================
# Stage 1: Build React App
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for both root and whatsapp-service
COPY package*.json ./
RUN npm ci

COPY whatsapp-service/package*.json ./whatsapp-service/
RUN cd whatsapp-service && npm ci

# Copy source and build the frontend
COPY . .
RUN npm run build

# ===========================================
# Stage 2: Production Server (Node.js)
# ===========================================
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY whatsapp-service/package*.json ./
RUN npm ci --only=production

# Copy the built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy the whatsapp-service source code
COPY whatsapp-service/ .

# Expose the WhatsApp service port
EXPOSE 3002

# The server.js in whatsapp-service already serves ../dist
CMD ["node", "server.js"]

