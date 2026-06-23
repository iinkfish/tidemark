FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ src/
# scrapers/ is mounted at runtime
CMD ["node", "src/main.js"]
