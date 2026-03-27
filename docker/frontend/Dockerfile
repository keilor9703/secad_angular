# Etapa 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación Angular
RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine AS runtime

# Copiar archivos de build de Angular
COPY --from=build /app/dist/policiadev-app /usr/share/nginx/html

# Copiar configuración de Nginx
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Iniciar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
