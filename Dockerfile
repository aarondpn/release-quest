FROM node:24.14.0-alpine@sha256:7fddd9ddeae8196abf4a3ef2de34e11f7b1a722119f91f28ddf1e99dcafdf114
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json config.json build.mjs ./
COPY server.ts ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY public/ ./public/
RUN npm run build
RUN npm prune --production
EXPOSE 3000
CMD ["node", "server.ts"]
