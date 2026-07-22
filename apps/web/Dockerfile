FROM nginx:1.27-alpine

FROM node:22-alpine AS assets
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/alexa/package.json apps/alexa/package.json
RUN npm ci --omit=dev

FROM nginx:1.27-alpine
COPY apps/web /usr/share/nginx/html
COPY --from=assets /app/node_modules/keycloak-js/lib/keycloak.js /usr/share/nginx/html/vendor/keycloak.js
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
