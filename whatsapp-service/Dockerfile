# Stage 1: Build WhatsApp Microservice  
FROM node:20-alpine AS builder  
  
WORKDIR /app  
  
# Install dependencies  
COPY package*.json ./  
RUN npm ci  
  
# Copy source code and build  
COPY . .  
  
# Build  
RUN npm run build 
  
# Stage 2: Production  
FROM node:20-alpine  
  
WORKDIR /app  
  
# Copy package files and install production dependencies  
COPY package*.json ./  
RUN npm ci --only=production  
  
# Copy source code from builder  
COPY --from=builder /app .  
  
# Expose port  
EXPOSE 3002  
  
# Health check  
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \  
    CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"  
  
# Start server  
CMD ["node", "server.js"] 
