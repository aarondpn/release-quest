FROM node:24.14.1-alpine@sha256:8510330d3eb72c804231a834b1a8ebb55cb3796c3e4431297a24d246b8add4d5
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
