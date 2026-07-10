# =============================================================================
#  WaCalls — Dockerfile multi-estágio
#  Build: embeds the React SPA into the Go binary's dist/ directory.
#  Runtime: Alpine Linux (~15 MB) + Go binary + frontend assets.
# =============================================================================

# ─── Stage 1: Build frontend (React + Vite) ──────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app

# Cache npm deps separately (layer reuse)
COPY client/package*.json ./client/
RUN cd client && npm ci --no-audit --no-fund

# Build the SPA (output goes to /app/dist/)
COPY client/ ./client/
RUN cd client && npm run build

# ─── Stage 2: Build Go backend (static binary, no CGO) ──────────────────
FROM golang:1.26-alpine AS backend
WORKDIR /app

# Cache Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy everything, then overlay the frontend dist/
COPY . .
COPY --from=frontend /app/dist ./dist

# Compile a fully static binary (no libc, no CGO)
RUN CGO_ENABLED=0 GOOS=linux go build -o wacalls-server ./cmd/server

# ─── Stage 3: Tiny runtime image ─────────────────────────────────────────
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget

# Timezone for Brazilian logs
ENV TZ=America/Sao_Paulo

WORKDIR /app
COPY --from=backend /app/wacalls-server .
COPY --from=backend /app/dist ./dist

# The Go binary auto-serves the SPA from /app/dist, proxies /api/*, SSE, etc.
EXPOSE 8080

# Database stored on a Docker volume mounted at /data
VOLUME ["/data"]

# Flags:
#   -addr :8080          → internal HTTP port (Dokploy/Traefik proxies external)
#   -static /app/dist    → pre-built SPA assets
#   -db /data/wacalls.db → SQLite database persisted on Docker volume
#   -seed-admin-email    → default admin created on first boot
#   -seed-admin-password → default admin password
ENTRYPOINT ["/app/wacalls-server"]
CMD ["-addr", ":8080", "-static", "/app/dist", "-db", "/data/wacalls.db", \
     "-seed-admin-email", "wacalls@admin.com", "-seed-admin-password", "admin"]
