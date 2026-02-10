# SurfSense — Guide de démarrage

## Pré-requis
- Node.js 18+
- Une clé Stormglass dans un fichier `.env` (voir `.env.example`)

## Lancer le backend (API)

```bash
cd "api "
npm install
npm run dev
```

Le serveur démarre sur `http://localhost:3001` avec les routes :
- `GET /api/marine?lat=...&lng=...`
- `GET /api/tide?lat=...&lng=...`
- `GET /api/top-spots`
- `GET /api/news`

## Lancer le front

```bash
cd "main "
python -m http.server 8000
```

Ouvrir ensuite `http://localhost:8000/index.html`.

## Notes
- La clé Stormglass reste côté serveur (jamais exposée au front).
- Les données sont mises en cache : 10 min (marine/tide/top-spots), 15 min (news).
# surfsense-app
# surfsense.app
