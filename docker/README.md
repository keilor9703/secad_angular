# SISGE - Docker Deployment

## Estructura

```
docker/
├── docker-compose.yml     # Orquestación de servicios
├── .env.example           # Variables de entorno de ejemplo
├── backend/
│   └── Dockerfile         # Imagen del API .NET 8
└── frontend/
    ├── Dockerfile         # Imagen del Frontend Angular + Nginx
    └── nginx.conf         # Configuración de Nginx
```

## Requisitos

- Docker 20.10+
- Docker Compose 2.0+

## Configuración

1. Copiar el archivo de variables de entorno:
   ```bash
   cp .env.example .env
   ```

2. Editar `.env` con tus credenciales:
   - ConnectionStrings__Oracle (cadena de conexión Oracle)
   - Jwt__Key (clave secreta mínimo 32 caracteres)
   - PipClientId / PipClientSecret (API PIP)

## Ejecución

### Desarrollo (build local)
```bash
docker-compose up --build
```

### Producción (optimizado)
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Ver logs
```bash
docker-compose logs -f
```

### Detener
```bash
docker-compose down
```

## URLs

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost |
| API | http://localhost:5000 |
| Swagger | http://localhost:5000/swagger |
| Health | http://localhost:5000/health |

## Endpoints Públicos

Una vez desplegado, los siguientes endpoints están disponibles sin autenticación:

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/Radio` | Emisoras de radio activas |
| `GET /api/Slider/Publicos` | Sliders públicos |
| `GET /api/Branding/config` | Configuración de marca |
| `GET /api/VideoUnidad/Publico` | Videos de unidad |
| `GET /api/LineaMando` | Línea de mando activa |

## Producción con HTTPS

Para producción con SSL, agregar un reverse proxy (Traefik, Nginx) frente a los contenedores.

## Troubleshooting

### La API no conecta a Oracle
- Verificar que la cadena de conexión sea correcta
- Asegurar que el servidor Oracle sea accesible desde el contenedor

### CORS errors
- Los endpoints públicos ya tienen CORS configurado
- Para endpoints protegidos, incluir el token JWT en el header Authorization

### Uploads no funcionan
- Verificar que el volumen `backend-uploads` esté montado correctamente
- Comprobar permisos de escritura en el volumen
