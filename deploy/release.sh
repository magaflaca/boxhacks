#!/usr/bin/env bash
# Publica el commit actual en el servidor. Uso: BOX_SSH=root@servidor deploy/release.sh
set -euo pipefail

: "${BOX_SSH:?Define BOX_SSH, por ejemplo root@servidor}"

git archive --format=tar HEAD | ssh "$BOX_SSH" '
  set -e
  APP=/opt/boxhacks/app
  rm -rf $APP.next && mkdir -p $APP.next && tar -x -C $APP.next
  bash $APP.next/deploy/install.sh
  cd $APP.next && PATH=/opt/boxhacks/runtime/bin:$PATH npm ci --omit=dev --silent
  rm -rf $APP.prev
  [ ! -d $APP ] || mv $APP $APP.prev
  mv $APP.next $APP
  systemctl restart boxhacks
'
