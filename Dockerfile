FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY tsconfig.json config.json ./
COPY server.ts ./
COPY server/ ./server/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "server.ts"]
