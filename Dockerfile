FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm --prefix client install

COPY client ./client
RUN npm --prefix client run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV USE_MEMORY_DB=false
ENV SERVE_CLIENT=true

COPY server/package.json ./server/
RUN npm --prefix server install --omit=dev

COPY server ./server
COPY --from=builder /app/client/dist ./client/dist

RUN mkdir -p /app/server/uploads

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/v1/health || exit 1

CMD ["node", "server/src/server.js"]
