# Production API image. Runtime configuration is injected by Railway only when
# the container starts. Do not add ARG/ENV entries for credentials here: build
# arguments end up in image metadata and can leak through build logs or layers.
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY legal ./legal
COPY index.html styles.css app.js admin.html admin.css admin.js firebase-auth.js runtime-config.js ./

USER node
EXPOSE 3333
CMD ["node", "server/index.js"]
