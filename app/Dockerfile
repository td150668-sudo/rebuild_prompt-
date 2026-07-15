# Optimized for Render.com Free Tier
# Multi-stage build to minimize image size → faster cold start
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/out ./out
COPY package.json lang.json ./
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "out/index.js"]
