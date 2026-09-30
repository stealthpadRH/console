# Stealthpad console: Next.js standalone output in a non-root container.
# Only NEXT_PUBLIC_* build args are baked into the image. DATABASE_URL is runtime env, never an image layer.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_CHAIN_ID=4663
ARG NEXT_PUBLIC_RPC_URL=https://rpc.mainnet.chain.robinhood.com
ARG NEXT_PUBLIC_FACTORY=
ARG NEXT_PUBLIC_FACTORY_BLOCK=
ARG NEXT_PUBLIC_APP_URL=https://app.stealthpad.online
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
    NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL \
    NEXT_PUBLIC_FACTORY=$NEXT_PUBLIC_FACTORY \
    NEXT_PUBLIC_FACTORY_BLOCK=$NEXT_PUBLIC_FACTORY_BLOCK \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
# the official image ships an unprivileged "node" user (uid 1000); run as it, never as root
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
