FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL isn't needed at build time (no pages hit the DB during `next build`
# because every data page sets `export const dynamic = 'force-dynamic'`), but Next
# still wants the var defined so it doesn't warn. Any placeholder works here.
ENV DATABASE_URL=postgres://placeholder/placeholder
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Full node_modules (not just the standalone trace) so db/migrate.mjs and
# db/seed-admin.mjs — run directly with `node`, outside the Next bundle — can
# still `require('pg')` / `require('bcryptjs')`.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/db ./db
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["sh", "-c", "node db/migrate.mjs && node server.js"]
