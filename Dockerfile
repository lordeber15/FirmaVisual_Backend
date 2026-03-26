# ─── Development ───
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/uploads
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ─── Production ───
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN mkdir -p /app/uploads

# Run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001
CMD ["dumb-init", "node", "src/index.js"]
