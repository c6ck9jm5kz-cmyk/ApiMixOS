#!/usr/bin/env bash
# One-shot production deploy for the Apimix (ai60.top) server.
#
# Usage on the server (as root):
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/c6ck9jm5kz-cmyk/ApiMixOS/main/scripts/deploy-apimix.sh)"
#
# What it does: updates the source checkout to origin/main, builds a new image
# with Dockerfile.custom, switches the new-api container in /opt/apimix to it,
# waits for the health check, and restores the previous compose file and
# container automatically if the new one does not become healthy.
set -euo pipefail

SRC_DIR=${SRC_DIR:-/root/apimix-ui/src}
COMPOSE_DIR=${COMPOSE_DIR:-/opt/apimix}
REPO_URL=${REPO_URL:-https://github.com/c6ck9jm5kz-cmyk/ApiMixOS}
BRANCH=${BRANCH:-main}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3001/api/status}

log() { printf '\n==> %s\n' "$*"; }

log "Updating source in $SRC_DIR from $REPO_URL ($BRANCH)"
cd "$SRC_DIR"
if [ -n "$(git status --porcelain)" ]; then
  echo "Source checkout has local changes; refusing to deploy:" >&2
  git status --short >&2
  exit 1
fi
git remote set-url origin "$REPO_URL"
git fetch -q origin "$BRANCH"
SHA=$(git rev-parse --short FETCH_HEAD)
git checkout -q -B "deploy/$SHA" FETCH_HEAD
TAG="new-api:lmzh-apimix-$SHA"
BUILD_LOG="/root/apimix-build-$SHA.log"

log "Building $TAG (log: $BUILD_LOG)"
if ! docker build -f Dockerfile.custom -t "$TAG" . >"$BUILD_LOG" 2>&1; then
  tail -40 "$BUILD_LOG" >&2
  echo "Build failed; production was not touched." >&2
  exit 1
fi

cd "$COMPOSE_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="docker-compose.yml.backup-before-$SHA-$STAMP"
cp docker-compose.yml "$BACKUP"
PREVIOUS_IMAGE=$(grep -E '^\s*image:\s*new-api:' docker-compose.yml | head -1 | sed -E 's/^\s*image:\s*//')
if [ -z "$PREVIOUS_IMAGE" ]; then
  echo "Could not find the new-api image line in docker-compose.yml; refusing to deploy." >&2
  exit 1
fi

log "Switching new-api from $PREVIOUS_IMAGE to $TAG"
sed -i -E "s#^(\s*image:\s*)new-api:[^[:space:]]+#\1$TAG#" docker-compose.yml
docker compose up -d new-api

healthy=0
for _ in $(seq 1 40); do
  status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' new-api 2>/dev/null || true)
  if [ "$status" = "healthy" ] && curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 3
done

if [ "$healthy" != 1 ]; then
  log "New container did not become healthy; rolling back to $PREVIOUS_IMAGE"
  docker logs --tail 60 new-api >&2 || true
  cp "$BACKUP" docker-compose.yml
  docker compose up -d new-api
  echo "ROLLED BACK. Production is back on $PREVIOUS_IMAGE." >&2
  exit 1
fi

log "DEPLOYED $TAG"
echo "Previous image: $PREVIOUS_IMAGE (compose backup: $COMPOSE_DIR/$BACKUP)"
echo "Rollback: cp $COMPOSE_DIR/$BACKUP $COMPOSE_DIR/docker-compose.yml && cd $COMPOSE_DIR && docker compose up -d new-api"
