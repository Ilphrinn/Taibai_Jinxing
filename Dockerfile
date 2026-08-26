# Image en deux temps : on compile dans la premiere, on n embarque que le resultat.
# Railway detecte ce fichier tout seul et s en sert a la place de Nixpacks.

FROM node:24-slim AS build

# node-gyp compile @discordjs/opus (encodeur natif, bien plus leger en CPU
# que la version JavaScript de secours).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./

# --omit=dev : aucune dependance de developpement dans l image finale.
RUN npm ci --omit=dev --no-audit --no-fund

# ---

FROM node:24-slim AS runtime

# ffmpeg du systeme : plus sur qu un binaire telecharge, et deja a jour.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    MUSIQUE_DIR=/app/assets/musique

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY assets ./assets

# Le conteneur ne stocke rien : aucun volume a monter.
RUN chown -R node:node /app
USER node

# tini transmet SIGTERM proprement : le bot quitte les salons vocaux avant de mourir.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
