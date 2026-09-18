FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/alexa/package.json apps/alexa/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @family/alexa --omit=dev --ignore-scripts
COPY apps/alexa apps/alexa
ENV NODE_ENV=production
USER node
CMD ["node", "apps/alexa/src/server.js"]
