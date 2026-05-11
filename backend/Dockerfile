# ============================================================
# S10 BizSmartHub — Backend Dockerfile (production)
# ============================================================

# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build && ./node_modules/.bin/prisma generate

# --- Runtime stage ---
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
# Copy generated Prisma client and CLI from builder (prisma is a devDependency)
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /usr/src/app/node_modules/prisma ./node_modules/prisma

EXPOSE 3202

# Apply schema changes (new indexes) before starting the app
CMD sh -c "npx prisma db push --skip-generate 2>/dev/null || true && node dist/main"
