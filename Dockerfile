# Stage 1: Build the React Application
FROM node:20-alpine as build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf



# Copy environment config template (source for envsubst)
COPY nginx-env.template.js /usr/share/nginx/html/nginx-env.template.js

# Expose port 80
EXPOSE 80

# Start Nginx using a shell to generate the config file at runtime
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/nginx-env.template.js > /usr/share/nginx/html/env-config.js && nginx -g 'daemon off;'"]
