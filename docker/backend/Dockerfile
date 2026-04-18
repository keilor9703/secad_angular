# Etapa 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar archivos de solución y proyecto
COPY ofic/oftic.sln .
COPY ofic/oftic/oftic.csproj ofic/oftic/oftic.csproj
COPY ofic/oftic.cl/oftic.cl.csproj ofic/oftic.cl/oftic.cl.csproj
COPY ofic/oftic.dl/oftic.dl.csproj ofic/oftic.dl/oftic.dl.csproj
COPY ofic/oftic.bl/oftic.bl.csproj ofic/oftic.bl/oftic.bl.csproj

# Restaurar dependencias
RUN dotnet restore

# Copiar todo el código fuente
COPY . .

# Publicar la aplicación
WORKDIR /src/oftic/oftic
RUN dotnet publish -c Release -o /app/publish --no-restore

# Etapa 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Crear directorio para uploads
RUN mkdir -p /app/uploads/sliders /app/uploads/radio /app/uploads/branding

# Copiar archivos publicados
COPY --from=build /app/publish .

# Exponer puerto
EXPOSE 8080

# Variable de entorno para el puerto
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "oftic.dll"]
