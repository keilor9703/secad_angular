# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# La solución vive en backend/oftic/oftic/oftic.sln y referencia sus proyectos
# hermanos con rutas relativas (..\oftic.cl\Comun.csproj, etc. — nombres de
# carpeta y de .csproj no coinciden: oftic.cl->Comun, oftic.dl->Datos,
# oftic.bl->Negocio, oftic.sl->Servicios). Se copia el árbol completo tal cual
# para que esas rutas relativas resuelvan sin tener que reconstruirlas a mano.
COPY backend/oftic/ ./backend/oftic/

WORKDIR /src/backend/oftic/oftic
RUN dotnet restore oftic.sln

# Publish
RUN dotnet publish Api.csproj -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads/noticias && \
    mkdir -p /app/uploads/sliders && \
    mkdir -p /app/uploads/login && \
    mkdir -p /app/uploads/videos

COPY --from=build /app/publish .

EXPOSE 8088

ENV ASPNETCORE_URLS=http://+:8088
ENV ASPNETCORE_ENVIRONMENT=Production
ENV TZ=America/Bogota

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8088/api/health || exit 1

ENTRYPOINT ["dotnet", "Api.dll"]
