# Etape 1: Build avec Node.js
FROM node:20-alpine AS build

WORKDIR /app

# Copier les fichiers de dependances
COPY package.json package-lock.json* ./

# Installer les dependances
RUN npm install

# Copier le code source
COPY . .

# Variables d'environnement pour le build
ARG VITE_API_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build de production
RUN npm run build

# Etape 2: Servir avec Nginx
FROM nginx:alpine

# Copier la config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
