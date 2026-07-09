# ============================================================
# S10 BizSmartHub — Backend Dockerfile (production)
# ============================================================

# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
# Generar el cliente Prisma ANTES de compilar — tsc necesita los tipos de
# los modelos (p.ej. LedgerEntry) o la compilación falla.
RUN ./node_modules/.bin/prisma generate && npm run build

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
# `exec` reemplaza a sh por node: si no, sh queda de PID 1 y no reenvia SIGTERM al
# hijo -> apagado sucio (exit 137) en cada recreate. Ver CLAUDE.md #23.
CMD sh -c "npx prisma db push --skip-generate 2>/dev/null || true && exec node dist/main"
