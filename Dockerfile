# Stage 1: Build the Vue client
FROM node:20-alpine AS client-build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile
COPY client/ client/
RUN pnpm --filter client build

# Stage 2: Production server
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --prod
COPY server/ server/
COPY --from=client-build /app/client/dist client/dist

EXPOSE 1994

CMD ["node", "server/index.js"]
