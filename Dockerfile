FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY scripts scripts
COPY server server
COPY public public
COPY drizzle drizzle
RUN node scripts/build.mjs && mkdir -p /data && chown node:node /data
USER node
CMD ["node", "server/homelab.mjs"]
