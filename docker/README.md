# SISGE - Guía de Despliegue

## Estructura del Proyecto

```
sisgeNg/
├── backend/          # API .NET 8
├── frontend/         # Angular 17
└── docker/          # Configuración para contenedores
    ├── docker-compose.yml
    ├── .env.example
    ├── backend/Dockerfile
    └── frontend/Dockerfile + nginx.conf
```

---

## OPCIÓN 1: Publicación con Docker (Recomendado)

### Requisitos del Servidor

- Ubuntu 20.04+ / Debian 11+
- Docker 20.10+
- Docker Compose 2.0+
- Acceso a internet (para descargar imágenes)

### Instalación de Docker en Oracle Linux 8

```bash
# Conectar por SSH y ejecutar como root:

# 1. Eliminar versiones previas de Docker
sudo yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine

# 2. Instalar dependencias
sudo yum install -y yum-utils

# 3. Agregar repositorio Docker (Oracle Linux 8 / CentOS 8)
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 4. Instalar Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Iniciar y habilitar Docker
sudo systemctl start docker
sudo systemctl enable docker

# 6. Verificar instalación
docker --version
sudo docker run hello-world
```

### Despliegue

```bash
# 1. Conectar al servidor por SSH
ssh usuario@servidor

# 2. Instalar Git si no está (Oracle Linux)
sudo yum install -y git

# 3. Clonar el repositorio
git clone https://github.com/tu-usuario/sisgeNg.git
cd sisgeNg/docker

# 4. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar ConnectionStrings__Oracle y Jwt__Key

# 5. Habilitar puerto 80/443 en firewall (Oracle Linux)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# 6. Construir y ejecutar
docker-compose up --build -d

# 7. Verificar estado
docker-compose ps
docker-compose logs -f
```

### URLs del Sistema

| Servicio | URL |
|---------|-----|
| Frontend | http://tu-servidor |
| API | http://tu-servidor:5000 |

---

## OPCIÓN 2: Publicación Tradicional (Sin Docker)

### Backend .NET 8

```bash
# En tu máquina local

# 1. Publicar backend
cd backend/oftic/oftic
dotnet publish -c Release -o ../../publish/api

# 2. Comprimir
powershell Compress-Archive -Path ../../publish/api/* -DestinationPath ../../publish/api.zip

# 3. Copiar al servidor por FTP/SCP
scp publish/api.zip usuario@servidor:/ruta/
```

### Frontend Angular

```bash
# En tu máquina local

# 1. Construir para producción
cd frontend
npm install
npm run build -- --configuration=production

# 2. Comprimir
powershell Compress-Archive -Path dist/* -DestinationPath ../publish/frontend.zip

# 3. Copiar al servidor
scp publish/frontend.zip usuario@servidor:/ruta/
```

### En el Servidor (IIS)

1. Instalar .NET 8 Runtime
2. Crear sitio en IIS
3. Descomprimir y configurar

---

## CONFIGURACIÓN DE PRODUCCIÓN

### Variables Obligatorias

Editar `docker/.env`:

```env
# Oracle
ConnectionStrings__Oracle=Data Source=(DESCRIPTION=...);User ID=TU_USER;Password=TU_PASS

# JWT (cambiar esta clave!)
Jwt__Key=UnaClaveMuySeguraDeAlMenos32Caracteres!
Jwt__Issuer=oftic.api
Jwt__Audience=oftic.api
```

---

## TROUBLESHOOTING

### La API no conecta a Oracle
- Verificar cadena de conexión
- Asegurar que el servidor Oracle permita conexiones externas

### Imágenes no cargan
- Verificar volumen Docker: `docker volume ls`

### Logs
```bash
docker-compose logs -f api
docker-compose logs -f frontend
```

### Reiniciar
```bash
docker-compose down
docker-compose up -d
```
