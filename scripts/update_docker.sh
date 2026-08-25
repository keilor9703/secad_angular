#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# SECAD — actualizar y redesplegar con Docker
#
# Pensado para un servidor que YA corre este stack via docker-compose.yml
# (ver README_DEPLOY.md, sección "Opción Docker") y que además aloja otros
# proyectos — este script solo toca el directorio del repo desde el que se
# ejecuta y los contenedores/red/volúmenes de ESTE docker-compose.yml
# (nombrados explícitamente: secad-api, secad-frontend, secad-network), sin
# afectar nada más en el servidor.
#
# Qué hace:
#   1. Verifica que no haya cambios locales sin commitear (aborta si los hay,
#      para no perderlos con el pull).
#   2. git fetch + pull de la rama indicada (por defecto, la rama actual).
#   3. docker compose build de las imágenes que cambiaron.
#   4. docker compose up -d (recrea solo los contenedores cuya imagen cambió).
#   5. Limpia imágenes viejas sin usar (docker image prune) para no acumular
#      espacio en disco con cada actualización.
#   6. Muestra el estado final de los contenedores.
#
# Uso:
#   ./scripts/update_docker.sh                  # usa la rama actualmente activa
#   ./scripts/update_docker.sh Dev_TMartinez1    # fuerza una rama específica
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "========================================="
echo "  SECAD — actualizar y redesplegar"
echo "  Repo:   $REPO_ROOT"
echo "  Rama:   $BRANCH"
echo "========================================="

if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: hay cambios locales sin commitear en $REPO_ROOT."
    echo "       Resuélvelos (commit/stash) antes de actualizar, para no perderlos con el pull."
    git status --short
    exit 1
fi

if [[ ! -f ".env" ]]; then
    echo "ERROR: no existe .env en $REPO_ROOT (cp .env.example .env y complétalo antes de desplegar)."
    exit 1
fi

echo "[1/5] git fetch..."
git fetch origin "$BRANCH"

echo "[2/5] git checkout + pull $BRANCH..."
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[3/5] docker compose build..."
docker compose build

echo "[4/5] docker compose up -d (recrea solo lo que cambió)..."
docker compose up -d

echo "[5/5] Limpiando imágenes viejas sin usar..."
docker image prune -f

echo ""
echo "========================================="
echo "  DEPLOY COMPLETADO"
echo "========================================="
docker compose ps
