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

# Copy source and build the frontend
COPY . .
RUN npm run build

# ===========================================
# Stage 2: Production Server (Node.js)
# ===========================================
FROM node:20-alpine

WORKDIR /app

# Install git even in production if needed by any runtime dependencies
RUN apk add --no-cache git

# Copy package files and install production dependencies
COPY whatsapp-service/package*.json ./
RUN npm install --omit=dev

# Copy the built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy the whatsapp-service source code
COPY whatsapp-service/ .

# Expose the WhatsApp service port
EXPOSE 3002

# The server.js in whatsapp-service already serves ../dist
CMD ["node", "server.js"]



