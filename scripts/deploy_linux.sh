#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo ./deploy_linux.sh
# Optional env vars:
#   API_DIR=/opt/oftic/api
#   WWW_DIR=/opt/oftic/www
#   BACKUP_DIR=/opt/oftic/backups
#   API_TAR=/tmp/api-release.tar.gz
#   WEB_TAR=/tmp/web-release.tar.gz

API_DIR="${API_DIR:-/opt/oftic/api}"
WWW_DIR="${WWW_DIR:-/opt/oftic/www}"
BASE_DIR="$(dirname "$API_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$BASE_DIR/backups}"
API_TAR="${API_TAR:-/tmp/api-release.tar.gz}"
WEB_TAR="${WEB_TAR:-/tmp/web-release.tar.gz}"
PORT="${PORT:-8088}"
STAMP="$(date +%F_%H%M%S)"

echo "== SISGE deploy (Linux) =="
echo "API dir:   $API_DIR"
echo "WEB dir:   $WWW_DIR"
echo "API tar:   $API_TAR"
echo "WEB tar:   $WEB_TAR"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: ejecuta como root o con sudo."
  exit 1
fi

for d in "$API_DIR" "$WWW_DIR"; do
  if [[ ! -d "$d" ]]; then
    echo "ERROR: no existe directorio: $d"
    exit 1
  fi
done

for f in "$API_TAR" "$WEB_TAR"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: no existe artefacto: $f"
    exit 1
  fi
done

mkdir -p "$BACKUP_DIR"

echo
echo "[1/7] Backup de API y WEB..."
tar -czf "$BACKUP_DIR/api_$STAMP.tar.gz" -C "$API_DIR" .
tar -czf "$BACKUP_DIR/www_$STAMP.tar.gz" -C "$WWW_DIR" .

echo
echo "[2/7] Deteniendo API (matando proceso dotnet)..."
pkill -9 -f "Api.dll" || true
fuser -k $PORT/tcp 2>/dev/null || true
sleep 2

echo
echo "[3/7] Limpiando API (preserva appsettings*.json y uploads)..."
find "$API_DIR" -mindepth 1 -maxdepth 1 \
  ! -name 'appsettings.json' \
  ! -name 'appsettings.Development.json' \
  ! -name 'appsettings.Production.json' \
  ! -name 'uploads' \
  -exec rm -rf {} +

echo
echo "[4/7] Extrayendo nueva API..."
tar -xzf "$API_TAR" -C "$API_DIR"

echo
echo "[5/7] Reemplazando frontend..."
find "$WWW_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf "$WEB_TAR" -C "$WWW_DIR"

echo
echo "[6/7] Ajustando permisos..."
chown -R root:root "$API_DIR" "$WWW_DIR"
chmod -R 755 "$API_DIR" "$WWW_DIR"

echo
echo "[7/7] Iniciando API..."
cd "$API_DIR"
nohup /usr/bin/dotnet Api.dll --urls "http://0.0.0.0:$PORT" > nohup.out 2>&1 &
sleep 3

echo
echo "Verificando API..."
curl -s http://localhost:$PORT/api/Noticia/activas > /dev/null && echo "API OK" || echo "API FALLO"

echo
echo "Deploy finalizado."
echo "Backups:"
echo "  $BACKUP_DIR/api_$STAMP.tar.gz"
echo "  $BACKUP_DIR/www_$STAMP.tar.gz"

