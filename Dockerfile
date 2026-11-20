# ============================================================================
# Red Ball Adventure — imagen de producción
#
# Un solo contenedor: Express sirve la API (/api) y los estáticos del juego.
# El frontend no necesita build (ES Modules nativos, sin bundler).
# ============================================================================

# ── Etapa 1: dependencias (solo producción) ─────────────────────────────────
FROM node:22-alpine AS dependencias

WORKDIR /app

# Los workspaces necesitan los tres package.json para resolver express.
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm install --omit=dev --no-audit --no-fund

# ── Etapa 2: imagen final ───────────────────────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

COPY --from=dependencias /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend

# El usuario `node` (ya existe en la imagen) es dueño de los datos.
RUN mkdir -p /app/backend/datos && chown -R node:node /app

USER node

EXPOSE 3000

# Docker reinicia el contenedor si la API deja de responder.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/src/servidor.js"]
