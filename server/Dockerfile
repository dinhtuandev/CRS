FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

FROM base AS runtime
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
