#!/bin/bash
set -euo pipefail

API_DIR="/opt/oftic/api"
WWW_DIR="/opt/oftic/www"
API_TAR="/tmp/api-release.tar.gz"
WEB_TAR="/tmp/web-release.tar.gz"
PORT=8088

echo "========================================="
echo "  SECAD DEPLOY - Servidor"
echo "========================================="

# Verificar archivos necesarios
if [[ ! -f "$API_TAR" ]]; then
    echo "ERROR: No se encuentra $API_TAR"
    exit 1
fi

if [[ ! -f "$WEB_TAR" ]]; then
    echo "ERROR: No se encuentra $WEB_TAR"
    exit 1
fi

# 1. Crear carpetas necesarias
echo "[1/6] Creando carpetas..."
mkdir -p "$API_DIR"
mkdir -p "$WWW_DIR"
mkdir -p /opt/oftic/uploads/noticias
mkdir -p /opt/oftic/uploads/sliders
mkdir -p /opt/oftic/uploads/login
mkdir -p /opt/oftic/uploads/videos
chmod -R 755 /opt/oftic/uploads
chown -R apache:apache /opt/oftic/uploads

# 2. Respaldar config existente
echo "[2/6] Respaldando configuración..."
if [[ -f "$API_DIR/appsettings.json" ]]; then
    cp "$API_DIR/appsettings.json" /tmp/appsettings_backup.json
fi

# 3. Detener API existente
echo "[3/6] Deteniendo API..."
pkill -f "Api.dll" 2>/dev/null || true
pkill -9 dotnet 2>/dev/null || true
sleep 2

# 4. Extraer API
echo "[4/6] Extrayendo API..."
cd "$API_DIR"
rm -rf *
tar -xzf "$API_TAR" .

# 5. Extraer Web
echo "[5/6] Extrayendo Frontend..."
cd "$WWW_DIR"
rm -rf *
tar -xzf "$WEB_TAR" .

# 6. Restaurar config
echo "[6/6] Restaurando configuración..."
if [[ -f /tmp/appsettings_backup.json ]]; then
    cp /tmp/appsettings_backup.json "$API_DIR/appsettings.json"
fi

# 7. Ajustar permisos
chown -R apache:apache "$API_DIR"
chown -R apache:apache "$WWW_DIR"
chmod -R 755 "$API_DIR"
chmod -R 755 "$WWW_DIR"

# 8. Iniciar API
echo "Iniciando API..."
cd "$API_DIR"
nohup dotnet Api.dll --urls "http://0.0.0.0:$PORT" > nohup.out 2>&1 &

# Esperar y verificar
sleep 5
echo ""
echo "Verificando API..."

if curl -s -f "http://localhost:$PORT/api/Noticia/activas" > /dev/null 2>&1; then
    echo "✅ API funcionando correctamente"
else
    echo "⚠️ API puede tener problemas, revisar nohup.out"
fi

echo ""
echo "========================================="
echo "  DEPLOY COMPLETADO"
echo "========================================="
echo ""
echo "URLs de prueba:"
echo "  API: http://localhost:$PORT/api/Noticia/activas"
echo "  Web: http://localhost:$PORT/"
