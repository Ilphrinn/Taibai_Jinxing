#!/usr/bin/env bash
# Envoie le bot sur le VPS (~/apps/taibai-jinxing), le (re)lance et declare ses commandes.
# Le .env ne vit que sur le VPS. S il n a pas encore de jeton, le script le demande (saisie
# masquee) et en deduit l Application ID : rien d autre a remplir.
# Les musiques de assets/musique partent avec le reste ; le bot les voit sans redemarrer.
set -euo pipefail
cd "$(dirname "$0")"
VPS="${VPS:-debian@51.195.219.143}"
DOSSIER=apps/taibai-jinxing
SERVEUR_DE_JEU=898206271738621983 # Recit des immortels

tar czf - --exclude=node_modules --exclude=.git --exclude=.env --exclude=scratchpad . \
  | ssh "$VPS" "mkdir -p ~/$DOSSIER && tar xzf - -C ~/$DOSSIER"
ssh "$VPS" "cd ~/$DOSSIER && [ -f .env ] || { cp .env.exemple .env && sed -i 's/^DISCORD_GUILD_ID=$/DISCORD_GUILD_ID=$SERVEUR_DE_JEU/' .env; }; chmod 600 .env"

if ! ssh "$VPS" "grep -q '^DISCORD_TOKEN=.' ~/$DOSSIER/.env"; then
  if [ ! -t 0 ]; then
    echo "Envoyé, pas lancé : le jeton manque. Relance ./deployer.sh dans un terminal pour le saisir."
    exit 0
  fi
  read -rsp "Jeton du bot (Developer Portal > Bot > Reset Token) — il ne s'affiche pas : " JETON
  echo
  # La premiere partie du jeton est l identifiant du bot en base64, qui est aussi l Application ID.
  ID="${JETON%%.*}"
  while [ $(( ${#ID} % 4 )) -ne 0 ]; do ID+='='; done
  ID=$(printf '%s' "$ID" | tr '_-' '/+' | base64 -d 2>/dev/null || true)
  if ! [[ "$ID" =~ ^[0-9]{17,20}$ ]]; then
    echo "Ce n'est pas un jeton de bot Discord. Rien n'a été changé."
    exit 1
  fi
  printf 'DISCORD_TOKEN=%s\nDISCORD_APPLICATION_ID=%s\n' "$JETON" "$ID" | ssh "$VPS" "cd ~/$DOSSIER && umask 077 \
    && grep -v -E '^(DISCORD_TOKEN|DISCORD_APPLICATION_ID)=' .env > .env.neuf && cat >> .env.neuf && mv .env.neuf .env"
  unset JETON
fi

ssh "$VPS" "cd ~/$DOSSIER && docker compose up -d --build \
  && docker compose run --rm --no-deps bot node src/deploy-commands.js \
  && docker compose logs --tail 20 bot"
