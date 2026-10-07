#!/usr/bin/env bash
set -euo pipefail

# Deploy atômico da Central do Assinante (frontend+backend) pra Hostinger.
#
# Por que não um `rsync --delete` direto em cima da pasta live (como foi
# feito manualmente em deploys anteriores): rsync não é atômico -- durante a
# sincronização existe uma janela real (segundos, às vezes mais em conexões
# lentas) em que a pasta publicada tem uma MISTURA de arquivos do build
# antigo e do novo. Um request que chegue nesse meio-tempo pode ver um
# index.html que referencia um JS que ainda não terminou de subir (404), ou
# qualquer outra combinação inconsistente -- exatamente o "/dist antigo +
# /dist novo" que causa comportamento aleatório depois de um deploy.
#
# Este script sincroniza pra um diretório NOVO, separado do que está no ar,
# e só troca pro ar com `mv` (rename de diretório, praticamente instantâneo,
# sem janela de mistura). Se o script for interrompido no meio, a pasta live
# nunca fica tocada -- o pior caso é um diretório .new- órfão pra limpar.

HOST="hostinger-acessanet"
REMOTE_APP_DIR="domains/acessanet.com.br/hbuilds/current/nodejs"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS=$(date +%Y%m%d%H%M%S)
BACKUPS_TO_KEEP=20

# Backup do auth.sqlite ANTES de qualquer coisa -- o README do backend avisa
# que a Hostinger pode apagar a pasta da app a cada deploy, perdendo clientes
# cadastrados (senha local, sessoes). Dois cuidados que uma copia ingenua
# (cp) nao teria:
#   1. O banco roda em modo WAL (ver sqlite.ts) -- nesse momento ha ~4MB de
#      dados ainda no auth.sqlite-wal, nao escritos no .sqlite principal.
#      Um "cp auth.sqlite backup.sqlite" direto pode gerar uma copia
#      incompleta/inconsistente. `sqlite3 .backup` sempre gera uma copia
#      consistente, em qualquer modo de journal, mesmo com o processo
#      escrevendo ao mesmo tempo.
#   2. O backup e baixado pra ESTA maquina, nao fica so dentro da propria
#      pasta do app na Hostinger -- um backup que mora no mesmo lugar que
#      pode ser apagado nao protege contra o cenario exato que ele existe
#      pra prevenir.
echo "==> Backing up auth.sqlite..."
REMOTE_DB_EXISTS=$(ssh "$HOST" "test -f $REMOTE_APP_DIR/data/auth.sqlite && echo yes || echo no")
if [ "$REMOTE_DB_EXISTS" = "yes" ]; then
  ssh "$HOST" "mkdir -p $REMOTE_APP_DIR/data/backups && \
    sqlite3 $REMOTE_APP_DIR/data/auth.sqlite \".backup $REMOTE_APP_DIR/data/backups/auth-$TS.sqlite\" && \
    cd $REMOTE_APP_DIR/data/backups && \
    ls -t auth-*.sqlite | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm --"

  mkdir -p "$ROOT_DIR/backups/auth-sqlite"
  scp -q -o LogLevel=ERROR "$HOST:$REMOTE_APP_DIR/data/backups/auth-$TS.sqlite" "$ROOT_DIR/backups/auth-sqlite/"
  (cd "$ROOT_DIR/backups/auth-sqlite" && ls -t auth-*.sqlite | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm --)
  echo "    auth-$TS.sqlite salvo remoto + local (backups/auth-sqlite/)"
else
  echo "    data/auth.sqlite ainda nao existe no servidor -- nada pra salvar (primeiro deploy?)"
fi

echo "==> Building frontend..."
(cd "$ROOT_DIR" && npm run build)

echo "==> Building backend..."
(cd "$ROOT_DIR/server" && npm run build)

echo "==> Staging new frontend build (public.new-$TS)..."
ssh "$HOST" "mkdir -p $REMOTE_APP_DIR/public.new-$TS"
rsync -azc --delete -e ssh "$ROOT_DIR/dist/" "$HOST:$REMOTE_APP_DIR/public.new-$TS/"

echo "==> Staging new backend build (dist.new-$TS)..."
ssh "$HOST" "mkdir -p $REMOTE_APP_DIR/dist.new-$TS"
rsync -azc --delete -e ssh "$ROOT_DIR/server/dist/" "$HOST:$REMOTE_APP_DIR/dist.new-$TS/"

echo "==> Atomic swap + restart..."
ssh "$HOST" "cd $REMOTE_APP_DIR && \
  rm -rf public.old dist.old && \
  mv public public.old && mv public.new-$TS public && \
  mv dist dist.old && mv dist.new-$TS dist && \
  rm -rf public.old dist.old && \
  touch tmp/restart.txt"

echo "==> Waiting for restart..."
sleep 2

echo "==> Health check:"
curl -s https://acessanet.com.br/api/health
echo
echo "==> Done."
