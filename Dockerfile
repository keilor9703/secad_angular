# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and projects
COPY backend/oftic/oftic.sln .
COPY backend/oftic/oftic.cl/oftic.cl.csproj ./oftic.cl/
COPY backend/oftic/oftic.dl/oftic.dl.csproj ./oftic.dl/
COPY backend/oftic/oftic.bl/oftic.bl.csproj ./oftic.bl/
COPY backend/oftic/oftic.sl/oftic.sl.csproj ./oftic.sl/
COPY backend/oftic/oftic/Api.csproj ./Api/
COPY backend/oftic/oftic/Comun.csproj ./Comun/

# Restore packages
RUN dotnet restore oftic.sln

# Copy all source
COPY backend/oftic/ .

# Publish
WORKDIR /src/backend/oftic
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

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8088/api/health || exit 1

ENTRYPOINT ["dotnet", "Api.dll"]
