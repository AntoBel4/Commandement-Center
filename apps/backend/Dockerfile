FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/alexa/package.json apps/alexa/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY apps/backend apps/backend
COPY supabase/migrations supabase/migrations

# Local checkouts may use umask 077. Runtime code must remain readable by node.
# Only application files and dependencies are copied into /app, never secrets.
RUN chmod -R a+rX /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000

USER node
CMD ["node", "apps/backend/src/server.js"]
