#!/bin/bash
set -ex

if pidof -o %PPID -x "update.sh" > /dev/null; then
	exit
fi

target=$HOME/update.sh
if wget -O "$target.tmp" "https://raw.githubusercontent.com/filecoin-project/saturn-node/main/update.sh" && [[ -s "$target.tmp" ]] && [ $(stat -c %s "$target.tmp") -ne $(stat -c %s "$target") ]
then
  mv -f "$target.tmp" "$target"
  echo $(date -u) "Updated update.sh script"
  exit
else
  rm -f "$target.tmp"
fi

out=$(sudo docker pull ghcr.io/filecoin-project/saturn-node:main)

if [[ $out != *"up to date"* ]]; then
  echo $(date -u) "Updating Saturn node..."

  sleep $((RANDOM % 60))
  sudo docker stop --time 30 saturn-node
  sudo docker rm -f saturn-node
  sudo docker run --name saturn-node -it -d --restart=unless-stopped -v $HOME/cache:/usr/src/app/cache -v $HOME/ssl:/etc/nginx/ssl -e FIL_WALLET_ADDRESS=$FIL_WALLET_ADDRESS --network host ghcr.io/filecoin-project/saturn-node:main
  sudo docker image prune -f

  echo $(date -u) "Update done!"
else
  echo $(date -u) "Node up to date"
fi