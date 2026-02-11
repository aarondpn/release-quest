FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json config.json build.mjs ./
COPY server.ts ./
COPY server/ ./server/
COPY public/ ./public/
COPY frontend/ ./frontend/
RUN npm run build
RUN npm prune --production
EXPOSE 3000
CMD ["node", "server.ts"]
