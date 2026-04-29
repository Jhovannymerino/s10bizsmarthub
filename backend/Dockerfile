# ============================================================
# S10 BizSmartHub — Backend Dockerfile (production)
# ============================================================

# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Generate Prisma client in runtime image
RUN npx prisma generate

EXPOSE 3202

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
