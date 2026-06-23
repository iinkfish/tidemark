FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/main.js src/scraperRunner.mjs src/db.js src/utils.js ./
# scrapers/ is mounted at runtime
CMD ["node", "main.js"]
