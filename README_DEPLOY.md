# Deploy SISGE (Windows + Linux/OL7)

Guía rápida para compilar, empaquetar y publicar SISGE en producción usando los scripts del repositorio.

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

## 1) Build en Windows

Desde la raíz del repo:

```powershell
cd C:\Users\Dyck.lopez\source\repos\sisgeNg
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
.\scripts\build_windows.ps1 -RepoRoot "D:\repos\sisgeNg"
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

