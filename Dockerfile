FROM node:22.17.1-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --workspaces=false
RUN mkdir -p /data && chown node:node /data
COPY src src
COPY public public
COPY migrations migrations
COPY scripts scripts
COPY content content
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/sharkpass.sqlite
USER node
EXPOSE 3000
CMD ["node", "--experimental-sqlite", "src/server.mjs"]
