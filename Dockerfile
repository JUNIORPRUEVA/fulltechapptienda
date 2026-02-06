FROM node:20-alpine

WORKDIR /app

# Dependencias
COPY package*.json ./
RUN npm install

# Código
COPY . .

# Prisma
RUN npx prisma generate

# Build
RUN npm run build

# Puerto Nest
EXPOSE 3000

# Arranque
CMD ["npm", "run", "start:prod"]
