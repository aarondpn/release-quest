FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY config.json ./
COPY server.js ./
COPY server/ ./server/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "server.js"]
