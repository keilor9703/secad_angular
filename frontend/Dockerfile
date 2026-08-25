# Etapa 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copiar manifiestos y el script que el postinstall necesita ANTES de npm ci —
# postinstall corre en cuanto termina npm ci, antes de que el resto del código
# fuente se copie a la imagen.
COPY package*.json ./
COPY scripts ./scripts
COPY patches ./patches
# package.json referencia "@policia/mfa" como dependencia local
# (file:dist-libs/policia-mfa-1.0.0.tgz) — npm ci necesita ese .tgz presente
# en el contexto de build, así que se copia junto con el resto de manifiestos,
# antes de npm ci (el resto del código fuente recién se copia después).
COPY dist-libs ./dist-libs

RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Construir la aplicación Angular
RUN npm run build -- --configuration=production

# Etapa 2: Servir con Nginx
FROM nginx:alpine AS runtime

# Copiar archivos de build de Angular
COPY --from=build /app/dist/policiadev-app/browser /usr/share/nginx/html

# Copiar configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Iniciar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
