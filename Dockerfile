# AssetFlow — image for one-command `docker compose up`.
FROM node:22-alpine
WORKDIR /app

# Prisma query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000

# Apply migrations + load demo data, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm start"]
