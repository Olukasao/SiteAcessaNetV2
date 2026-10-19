#!/usr/bin/env bash
set -euo pipefail

# Deploy atômico do site + backend (server/) para a Hostinger.
#
# Sincroniza para diretórios NOVOS (public.new-*/dist.new-*) e só troca para o
# ar com `mv`, praticamente instantâneo: nunca existe uma mistura de build
# antigo e novo na pasta publicada. Interrompido no meio, o que está no ar
# fica intacto -- o pior caso é um diretório .new- órfão para limpar.
#
# Dados de clientes ficam no MySQL (DB_DRIVER=mysql no .env do servidor) e
# nunca são tocados aqui: o deploy só troca public/ e dist/. Mesmo assim, o
# banco é copiado ANTES de qualquer coisa, no servidor e nesta máquina.
#
# Páginas antigas (/assinar-documento, /dados -- ver isLegacySpaPath em
# server/src/app.ts) saem do legacy.html. Por padrão ele é reaproveitado do
# que já está no ar; LEGACY_DIR=~/Site-Acessanet recompila do site antigo.

HOST="hostinger-acessanet"
REMOTE_APP_DIR="domains/acessanet.com.br/hbuilds/current/nodejs"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEGACY_DIR="${LEGACY_DIR-}"
TS=$(date +%Y%m%d%H%M%S)
BACKUPS_TO_KEEP=20
LOCAL_BACKUPS="$ROOT_DIR/backups"

prune() { (cd "$1" && ls -t $2 2>/dev/null | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm --); }

echo "==> Backup do MySQL..."
ssh "$HOST" "bash -s" <<EOF
set -euo pipefail
cd $REMOTE_APP_DIR
set -a; . ./.env; set +a
if [ "\${DB_DRIVER:-sqlite}" = "mysql" ]; then
  mkdir -p data/backups && umask 077
  mysqldump --single-transaction --quick --routines --no-tablespaces \
    -h "\$MYSQL_HOST" -P "\${MYSQL_PORT:-3306}" -u "\$MYSQL_USER" -p"\$MYSQL_PASSWORD" "\$MYSQL_DATABASE" 2>/dev/null \
    | gzip > data/backups/mysql-$TS.sql.gz
  gzip -t data/backups/mysql-$TS.sql.gz
  zcat data/backups/mysql-$TS.sql.gz | tail -1 | grep -q "Dump completed"
  cd data/backups && ls -t mysql-*.sql.gz | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm --
else
  echo "    DB_DRIVER nao e mysql -- sem dump"
fi
EOF
if ssh "$HOST" "test -f $REMOTE_APP_DIR/data/backups/mysql-$TS.sql.gz"; then
  mkdir -p "$LOCAL_BACKUPS/mysql"
  scp -q -o LogLevel=ERROR "$HOST:$REMOTE_APP_DIR/data/backups/mysql-$TS.sql.gz" "$LOCAL_BACKUPS/mysql/"
  chmod 600 "$LOCAL_BACKUPS/mysql/mysql-$TS.sql.gz"
  prune "$LOCAL_BACKUPS/mysql" "mysql-*.sql.gz"
  echo "    mysql-$TS.sql.gz salvo remoto + local (backups/mysql/)"
fi

# SQLite: só existe se o servidor um dia voltar para DB_DRIVER=sqlite. Banco em
# WAL -- `sqlite3 .backup` gera cópia consistente, um `cp` não.
echo "==> Backup do auth.sqlite..."
if [ "$(ssh "$HOST" "test -f $REMOTE_APP_DIR/data/auth.sqlite && echo yes || echo no")" = "yes" ]; then
  ssh "$HOST" "mkdir -p $REMOTE_APP_DIR/data/backups && \
    sqlite3 $REMOTE_APP_DIR/data/auth.sqlite \".backup $REMOTE_APP_DIR/data/backups/auth-$TS.sqlite\" && \
    cd $REMOTE_APP_DIR/data/backups && \
    ls -t auth-*.sqlite | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm --"
  mkdir -p "$LOCAL_BACKUPS/auth-sqlite"
  scp -q -o LogLevel=ERROR "$HOST:$REMOTE_APP_DIR/data/backups/auth-$TS.sqlite" "$LOCAL_BACKUPS/auth-sqlite/"
  prune "$LOCAL_BACKUPS/auth-sqlite" "auth-*.sqlite"
  echo "    auth-$TS.sqlite salvo remoto + local (backups/auth-sqlite/)"
else
  echo "    sem data/auth.sqlite no servidor"
fi

echo "==> Build do site..."
(cd "$ROOT_DIR" && npm run build)
if ! compgen -G "$ROOT_DIR/dist/assets/ClienteArea-*.js" > /dev/null; then
  echo "ERRO: build do site sem a Central integrada." >&2
  exit 1
fi

FRONTEND_DIR="$ROOT_DIR/dist"
if [ -n "$LEGACY_DIR" ]; then
  echo "==> Build do site antigo ($LEGACY_DIR) para legacy.html..."
  (cd "$LEGACY_DIR" && VITE_HYBRID_SITE=1 npm run build)
  FRONTEND_DIR="$ROOT_DIR/dist-hybrid"
  rm -rf "$FRONTEND_DIR"
  cp -a "$LEGACY_DIR/dist" "$FRONTEND_DIR"
  mv "$FRONTEND_DIR/index.html" "$FRONTEND_DIR/legacy.html"
  cp -a "$ROOT_DIR/dist/." "$FRONTEND_DIR/"
elif ! ssh "$HOST" "test -f $REMOTE_APP_DIR/public/legacy.html"; then
  echo "ERRO: sem public/legacy.html no servidor -- /assinar-documento e /dados sairiam do ar." >&2
  echo "      Rode com LEGACY_DIR=~/Site-Acessanet para recompilar o site antigo." >&2
  exit 1
fi

echo "==> Build do backend..."
[ -d "$ROOT_DIR/server/node_modules" ] || (cd "$ROOT_DIR/server" && npm ci)
(cd "$ROOT_DIR/server" && npm run build)

echo "==> Preparando novo frontend (public.new-$TS)..."
if [ -n "$LEGACY_DIR" ]; then
  ssh "$HOST" "mkdir -p $REMOTE_APP_DIR/public.new-$TS"
  rsync -azc --delete -e ssh "$FRONTEND_DIR/" "$HOST:$REMOTE_APP_DIR/public.new-$TS/"
  # Assets com hash continuam válidos para abas abertas; acumulam entre deploys.
  ssh "$HOST" "cd $REMOTE_APP_DIR && mkdir -p public.new-$TS/assets && cp -an public/assets/. public.new-$TS/assets/"
else
  # Parte do que está no ar (legacy.html, assets antigos para abas abertas,
  # arquivos estáticos do site antigo) e põe o build novo por cima, sem --delete.
  ssh "$HOST" "cd $REMOTE_APP_DIR && cp -a public public.new-$TS"
  rsync -azc -e ssh "$FRONTEND_DIR/" "$HOST:$REMOTE_APP_DIR/public.new-$TS/"
fi

echo "==> Preparando novo backend (dist.new-$TS)..."
ssh "$HOST" "mkdir -p $REMOTE_APP_DIR/dist.new-$TS"
rsync -azc --delete -e ssh "$ROOT_DIR/server/dist/" "$HOST:$REMOTE_APP_DIR/dist.new-$TS/"

echo "==> Troca atômica + restart..."
ssh "$HOST" "cd $REMOTE_APP_DIR && \
  mv public public.previous-$TS && mv public.new-$TS public && \
  mv dist dist.previous-$TS && mv dist.new-$TS dist && \
  touch tmp/restart.txt"

echo "==> Aguardando restart..."
sleep 2

echo "==> Health check:"
curl -fsS --max-time 30 https://acessanet.com.br/api/health
echo
echo "==> Pronto. Para voltar: mv public.previous-$TS / dist.previous-$TS de volta no servidor."
