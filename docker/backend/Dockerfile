# Etapa 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar archivos de solución y proyecto
COPY ofic.sln .
COPY ofic/offic.Api.csproj ofic/offic.Api.csproj
COPY ofic/offic.cl/offic.cl.csproj ofic/offic.cl/offic.cl.csproj
COPY ofic/offic.dl/offic.dl.csproj ofic/offic.dl/offic.dl.csproj
COPY ofic/offic.bl/offic.bl.csproj ofic/offic.bl/offic.bl.csproj
COPY ofic/offic.sl/offic.sl.csproj ofic/offic.sl/offic.sl.csproj

# Restaurar dependencias
RUN dotnet restore

# Copiar todo el código fuente
COPY . .

# Publicar la aplicación
WORKDIR /src/offic
RUN dotnet publish -c Release -o /app/publish --no-restore

# Etapa 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Crear directorio para uploads
RUN mkdir -p /app/uploads/sliders /app/uploads/radio

# Copiar archivos publicados
COPY --from=build /app/publish .

# Exponer puerto
EXPOSE 8080

# Variable de entorno para el puerto
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "oftic.Api.dll"]
