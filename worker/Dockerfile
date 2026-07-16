# The worker is deliberately separate from the public API service. It needs
# ffmpeg but must never expose source uploads or bind a public HTTP port.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
USER node
ENV NODE_ENV=production
CMD ["node", "src/runner.mjs"]
