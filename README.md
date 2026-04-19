# Centre de Commandement Familial

Implémentation MVP+ d'un centre de commandement familial basé sur la spécification fournie.

## Structure

- `apps/backend`: API Fastify (événements, courses, sync, webhooks), validation Zod, logs.
- `apps/alexa`: handler Alexa Skill (`AjouterEvenement`, `AjouterCourse`) qui appelle l'API backend.
- `apps/web`: interface web légère pour voir/créer des événements, gérer des courses et déclencher les syncs.
- `supabase/migrations`: schéma SQL initial pour Supabase/PostgreSQL.

## Prérequis

- Node.js 18+
- npm 9+

## Procédure de test pas à pas

### 1) Installer les dépendances

```bash
npm install
```

### 2) Lancer le backend

```bash
npm run dev:backend
```

Le backend écoute par défaut sur `http://localhost:3000`.

### 3) Vérifier l'API rapidement

```bash
curl http://localhost:3000/health
```

Réponse attendue:

```json
{"status":"ok"}
```

### 4) Tester la création d'un événement

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "content-type: application/json" \
  -d '{"title":"Dentiste","date":"2026-04-20","time":"15:00","person":"Paul","source":"dashboard"}'
```

### 5) Tester la création d'une course

```bash
curl -X POST http://localhost:3000/api/v1/grocery/batch \
  -H "content-type: application/json" \
  -d '{"items":[{"name":"Lait","quantity":2,"unit":"litres","source":"dashboard"}]}'
```

### 6) Lancer l'interface web

Depuis `apps/web`:

```bash
cd apps/web
python3 -m http.server 4173
```

Puis ouvrir `http://localhost:4173` dans le navigateur.

- Renseigner l'URL API (par défaut `http://localhost:3000`).
- Utiliser les formulaires pour créer événements/courses.
- Utiliser les boutons "Rafraîchir" et les boutons de sync.

### 7) Exécuter les tests automatiques

```bash
npm test
```

## Variables utiles

- `PORT`, `HOST`, `LOG_LEVEL` pour le backend.
- `FAMILY_API_BASE_URL` pour la lambda Alexa.
