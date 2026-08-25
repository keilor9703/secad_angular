# Deploy SECAD (Windows + Linux/OL7)

Guía rápida para compilar, empaquetar y publicar SECAD en producción usando los scripts del repositorio.

## Requisitos

- Windows (build):
  - `.NET SDK` instalado (`dotnet --version`)
  - `Node.js + npm` instalados (`node -v`, `npm -v`)
  - Acceso SSH al servidor (`scp`)
- Linux/OL7 (deploy):
  - Acceso con permisos `sudo/root`
  - Servicio systemd de la API disponible

## Estructura objetivo en servidor

- API: `/opt/oftic/api`
- WEB: `/opt/oftic/www`
- Servicio API: `oftic-api.service`

## Scripts incluidos

- Windows build: `scripts/build_windows.ps1`
- Linux deploy: `scripts/deploy_linux.sh`

---

## Opción Docker (alternativa a los pasos 1-5)

El repositorio incluye un `docker-compose.yml` en la raíz que levanta Postgres (`secad-postgres`), backend (`secad-api`, puerto 8088) y frontend (`secad-frontend`, puerto 80) en un solo stack — el Postgres es propio y aislado, con su propio volumen (`pgdata`), no comparte nada con otros proyectos del servidor.

```bash
git clone <url-del-repo> secad_angular
cd secad_angular
cp .env.example .env
nano .env   # completar POSTGRES_PASSWORD, JWT_KEY, RECEPCION_EXTERNA_API_KEY, SECAD_BASE_URL
docker-compose up --build -d
docker-compose ps
docker-compose logs -f
```

**Variables obligatorias en `.env`** (ver `.env.example`):
- `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`: credenciales del Postgres que el propio `docker-compose.yml` provisiona — con ellas arma `ConnectionStrings:MasterDb` automáticamente apuntando al contenedor `postgres`. Esa base maestra es la única que la API exige al arrancar; el enrutamiento a la base de cada CAD/tenant se resuelve desde ahí (tabla `secad_tenants`).
- `JWT_KEY`: reemplaza el placeholder de `appsettings.json`. Mínimo 32 caracteres aleatorios.
- `RECEPCION_EXTERNA_API_KEY`: reemplaza el placeholder que protege los endpoints de ingesta externa (PlantaTel/Chat/SMS, `RecepcionExternaController`).
- `SECAD_BASE_URL`: dominio público real de este despliegue (arma el link de videollamada que recibe el ciudadano).

**Primer arranque — cargar el esquema:** un Postgres recién creado está vacío. Hay que aplicar los scripts de `docs/sql/master/` (`V1` en adelante) contra la base maestra, y por cada tenant/CAD crear su propia base y aplicarle los scripts marcados como "apply to each tenant database" en su encabezado, además de insertar su fila en `secad_tenants`. No hay un runner de migraciones automático — se aplican a mano, por ejemplo:
```bash
for f in docs/sql/master/V*.sql; do
  echo "== $f =="
  docker exec -i secad-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$f"
done
```
(revisa el encabezado de cada archivo — algunos dicen explícitamente "apply to each CAD database", no a la maestra).

Troubleshooting:
- `ConnectionStrings:MasterDb no configurada` en los logs → falta `POSTGRES_PASSWORD` en `.env`, o `secad-postgres` no pasó su healthcheck todavía (`docker-compose ps`).
- Frontend carga pero las llamadas a `/api/...` fallan → confirma que el contenedor `secad-api` está `healthy` (`docker-compose ps`) antes de culpar al nginx del frontend.

### Servidor con otros proyectos ya desplegados (p.ej. Oracle OCI)

Este `docker-compose.yml` usa nombres de contenedor, red y volumen propios
(`secad-api`, `secad-frontend`, `secad-network`) — no interfiere con otros
proyectos en Docker en el mismo servidor. Lo único que sí es compartido a
nivel de servidor son los **puertos publicados en el host**:

1. Antes del primer `docker-compose up`, revisa qué puertos ya están en uso:
   ```bash
   sudo ss -tulnp | grep LISTEN
   sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
   ```
2. Si `80` y/o `8088` ya están tomados por otro proyecto, cambia
   `FRONTEND_PORT` y/o `API_PORT` en `.env` (ver `.env.example`) — no hace
   falta tocar `docker-compose.yml`.
3. Completa también `SECAD_BASE_URL` (dominio público real de este
   despliegue — arma el link de videollamada que recibe el ciudadano) e,
   si aplica, `INFOBIP_BASE_URL`/`INFOBIP_API_KEY`/`INFOBIP_SENDER` (envío
   del link por SMS) en `.env`.
4. Para actualizar el despliegue más adelante (traer cambios del repo y
   reconstruir/reiniciar solo lo que cambió), usa:
   ```bash
   ./scripts/update_docker.sh                 # actualiza la rama activa
   ./scripts/update_docker.sh Dev_TMartinez1  # o fuerza una rama puntual
   ```

---

## 1) Build en Windows

Desde la raíz del repo:

```powershell
cd C:\Users\Dyck.lopez\source\repos\secad_angular
.\scripts\build_windows.ps1
```

Esto hace:

1. `dotnet publish` de `Api.csproj`
2. genera `api-release.tar.gz` en `%TEMP%`
3. build Angular (`policiadev-app`)
4. genera `web-release.tar.gz` en `%TEMP%`

### Opción sin `npm ci`

```powershell
.\scripts\build_windows.ps1 -SkipNpmCi
```

### Opción con ruta de repo diferente

```powershell
.\scripts\build_windows.ps1 -RepoRoot "D:\repos\secad_angular"
```

---

## 2) Subir artefactos al servidor

```powershell
scp "$env:TEMP\api-release.tar.gz" usrcoest@srvsicoedesa:/tmp/
scp "$env:TEMP\web-release.tar.gz" usrcoest@srvsicoedesa:/tmp/
```

Verifica en servidor:

```bash
ls -lh /tmp/api-release.tar.gz /tmp/web-release.tar.gz
```

---

## 3) Deploy en Linux/OL7

Copiar script al servidor (opcional):

```powershell
scp ".\scripts\deploy_linux.sh" usrcoest@srvsicoedesa:/tmp/
```

Ejecutar:

```bash
sudo bash /tmp/deploy_linux.sh
```

### ¿Qué hace `deploy_linux.sh`?

1. valida rutas y artefactos
2. crea backups en `/opt/oftic/backups`
3. detiene `oftic-api.service`
4. limpia API preservando:
   - `appsettings.json`
   - `appsettings.Development.json`
   - `uploads/`
5. extrae nueva API
6. reemplaza frontend en `/opt/oftic/www`
7. ajusta permisos
8. levanta servicio y muestra estado

### Variables opcionales

```bash
sudo API_SERVICE=oftic-api.service \
API_DIR=/opt/oftic/api \
WWW_DIR=/opt/oftic/www \
BACKUP_DIR=/opt/oftic/backups \
API_TAR=/tmp/api-release.tar.gz \
WEB_TAR=/tmp/web-release.tar.gz \
bash /tmp/deploy_linux.sh
```

---

## 4) Validación post-deploy

### API

```bash
systemctl status oftic-api.service -n 50 --no-pager
journalctl -u oftic-api.service -n 50 --no-pager
```

Debes ver algo como:

- `Hosting environment: Production`
- `Now listening on: http://127.0.0.1:7095`

### Frontend publicado

```bash
ls -la /opt/oftic/www/browser
```

Debes ver `index.html`, `main-*.js`, `styles-*.css` actualizados.

### Verificación HTTP local

```bash
curl -I http://127.0.0.1/
```

Nota: si responde otro sitio (por ejemplo Drupal), el build puede estar bien publicado en disco, pero el virtual host/ruteo del servidor web no está apuntando a `/opt/oftic/www/browser`.

---

## 5) Rollback (manual)

1. detener API:

```bash
sudo systemctl stop oftic-api.service
```

2. restaurar API y WEB desde backup:

```bash
sudo rm -rf /opt/oftic/api/*
sudo tar -xzf /opt/oftic/backups/api_<FECHA>.tar.gz -C /opt/oftic/api

sudo rm -rf /opt/oftic/www/*
sudo tar -xzf /opt/oftic/backups/www_<FECHA>.tar.gz -C /opt/oftic/www
```

3. iniciar API:

```bash
sudo systemctl start oftic-api.service
sudo systemctl status oftic-api.service -n 50 --no-pager
```

---

## 6) Troubleshooting

- Error en Windows: `tar ... /tmp/...`  
  Usa rutas de Windows (`$env:TEMP`), no `/tmp`.

- Error `MSB1003` en `dotnet publish`  
  Estás en carpeta incorrecta. Debes compilar desde:
  `backend/oftic/oftic` (donde está `Api.csproj`).

- API arriba pero frontend no visible en `/`  
  Revisar configuración de Apache/Nginx (`DocumentRoot`, `Alias`, `ProxyPass`).

