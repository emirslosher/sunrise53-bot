FROM node:20-alpine

WORKDIR /app

# Bağımlılıkları yükle
COPY package*.json ./
RUN npm ci --only=production

# Kaynak kodları kopyala
COPY . .

# Botu çalıştır
CMD ["node", "index.js"]
