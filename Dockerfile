FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

FROM base AS deps
RUN npm ci --production
RUN cd server && npm ci --production
RUN cd client && npm ci --production

FROM base AS build
RUN npm ci
RUN cd server && npm ci
RUN cd client && npm ci
COPY . .
RUN cd client && npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/client/dist ./client/dist
COPY server/ ./server/
COPY package*.json ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
