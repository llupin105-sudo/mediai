# MediAI — backend containerisé.
# Image portable : se déploie à l'identique sur Render, Scaleway, OVHcloud,
# ou tout hôte de conteneurs — clé de la future migration HDS sans réécriture.

FROM node:20-alpine

# Répertoire de travail
WORKDIR /app

# Dépendances d'abord (meilleur cache de build)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Code applicatif
COPY . .

# En production : le garde-fou JWT_SECRET s'active (voir server.js).
ENV NODE_ENV=production

# Le port réel est fourni par la plateforme via la variable PORT.
EXPOSE 3001

CMD ["node", "server.js"]
