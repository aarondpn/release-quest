FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js ./
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "server.js"]
