FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates

COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# O prisma generate só lê o schema; a URL abaixo não é usada para conectar.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl ca-certificates curl

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=nestjs:nodejs /app/package.json /app/package-lock.json* ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh && chown nestjs:nodejs ./entrypoint.sh

USER nestjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/main.js"]
