FROM node:24.14.1-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b
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
