FROM node:20-alpine

WORKDIR /app

# Bağımlılıkları yükle
COPY package*.json ./
RUN npm install --omit=dev

# Kaynak kodları kopyala
COPY . .

# Botu çalıştır
CMD ["node", "index.js"]
