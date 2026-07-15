# MediAI — backend containerisé.
# Image portable : se déploie à l'identique sur Scaleway, OVHcloud, ou tout
# hôte de conteneurs — clé de la future migration HDS sans réécriture.
#
# Volontairement hors de la racine du repo pour ne PAS interférer avec le
# déploiement natif Node de Render. Build depuis la racine du repo (le
# .dockerignore y reste, c'est le contexte) :
#   docker build -f docker/Dockerfile -t mediai-backend .

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
