# DEPLOY — FIN-R sur Render

Infrastructure créée avec le **CLI Render** (`render` v2.22.0, workspace
« Alanni's workspace »), pas avec un blueprint `render.yaml`.

> Pourquoi pas de `render.yaml` dans le dépôt ? Parce que les ressources sont
> créées par le CLI. Un blueprint committé à côté créerait une seconde source
> de vérité, et le jour où quelqu'un lancerait `render blueprint launch`, on
> aurait des doublons. Ce fichier est donc la procédure, et lui seul.

## Ce qui est déployé

| Ressource Render | Type | Runtime | Origine |
|---|---|---|---|
| `finr-api-staging` | Web Service | `docker` | `finr-api/` (Dockerfile du dépôt) |
| `finr-nlp-staging` | Web Service | `python` | `finr-nlp/` |
| `finr-app-staging` | Static Site | `node` | `finr-app/` |
| `finr-postgres-staging` | Postgres | — | plan `free` (expire à 30 jours) |
| `finr-api` / `finr-nlp` / `finr-app` | idem | idem |idem, **créés seulement après staging vert** |

Dépôt : `https://github.com/idrissoualanni/finr`, branche `main`.
Projet : `finr` (`prj-db9vsgnavr4c73fk6as0`).

---

## Pourquoi PHP passe par Docker

Render n'a **pas de runtime PHP natif**. La seule voie supportée est un
service `docker`. L'image est construite depuis `finr-api/Dockerfile` :
nginx + php-fpm dans un même conteneur, `vendor/` cuit dans l'image (donc
aucun accès réseau au démarrage), migrations appliquées par l'entrypoint.

## Points de conception qui méritent d'être lus

- **`$PORT` et `envsubst`.** La config nginx est un gabarit
  (`docker/nginx.conf.template`). `entrypoint.sh` appelle
  `envsubst '${PORT}'` — avec la liste explicite. Sans elle, `envsubst`
  remplacerait aussi `$uri` et `$fastcgi_script_name`, et la config nginx
  deviendrait invalide.
- **Variables requises refusées au démarrage.** `APP_KEY`, `JWT_SECRET`,
  `DATABASE_URL`, `DB_CONNECTION` sont vérifiées avant toute commande artisan.
  Générer une clé au boot invaliderait les sessions et les JWT déjà émis ;
  mieux vaut un échec bruyant qu'une erreur Laravel en production.
- **Migrations avant `config:cache`.** Un `config:cache` figerait les valeurs
  lues avant la migration.
- **`$realpath_root`.** Sans lui, `SCRIPT_FILENAME` pointe vers un chemin que
  php-fpm ne voit pas et Laravel rend une page blanche.
- **Health check : `/up`.** Endpoint natif Laravel 12 déclaré dans
  `bootstrap/app.php`. Il est hors du groupe `api`, donc ne demande ni JWT ni
  base. Ne pas le confondre avec un test applicatif : un 200 sur `/up` prouve
  que PHP et nginx répondent, **pas** que la base est joignable.

---

## Commandes de création

```bash
# 1. Base de staging
render postgres create \
  --name finr-postgres-staging \
  --plan free \
  --region frankfurt \
  --project finr \
  --environment-id evm-db9vsgnavr4c73fk6asg \
  --confirm

# 2. Microservice NLP
render services create \
  --name finr-nlp-staging \
  --type web_service \
  --repo https://github.com/idrissoualanni/finr \
  --branch main \
  --root-directory finr-nlp \
  --runtime python \
  --plan free \
  --region frankfurt \
  --build-command "pip install -r requirements.txt" \
  --start-command "uvicorn app.main:app --host 0.0.0.0 --port \$PORT" \
  --health-check-path /health \
  --environment-id evm-db9vsgnavr4c73fk6asg \
  --confirm

# 3. API Laravel
render services create \
  --name finr-api-staging \
  --type web_service \
  --repo https://github.com/idrissoualanni/finr \
  --branch main \
  --root-directory finr-api \
  --runtime docker \
  --plan free \
  --region frankfurt \
  --health-check-path /up \
  --env-var APP_ENV=production \
  --env-var APP_DEBUG=false \
  --env-var DB_CONNECTION=pgsql \
  --env-var LOG_CHANNEL=stderr \
  --env-var LOG_LEVEL=info \
  --env-var NLP_SERVICE_URL=<url de finr-nlp-staging> \
  --env-var FRONTEND_URL=<url de finr-app-staging> \
  --environment-id evm-db9vsgnavr4c73fk6asg \
  --confirm
```

`APP_KEY` et `JWT_SECRET` **ne sont pas passés sur la ligne de commande** :
ils seraient écrits dans l'historique du shell. Ils se posent par l'API Render
avec vérification par empreinte, jamais affichés.

---

## Sondes de vérification

Un statut `live` ne prouve rien : un service peut démarrer puis échouer. Après
chaque déploiement, ces sondes sont obligatoires.

| Sonde | Attendu |
|---|---|
| `GET /up` | 200 |
| `GET /health` (NLP) | 200, `status: ok`, `classifiers_loaded: true` |
| `POST /api/auth/register` | 201/422 — **jamais 500** (500 = base injoignable ou migration absente) |
| `POST /api/auth/login` (corps malformé) | 401, message générique, **jamais 500** |
| En-tête `access-control-allow-origin` avec l'`Origin` du front | ACAO = origine exacte, `ACAC: true`, **jamais `*`** |
| Statut du deploy | `live`, et le commit déployé **est** le commit poussé |
| Base | schéma présent (`users`, `sessions`, `cache`, `jobs`, tables FIN-R) |

Le test qui distingue vraiment une API qui marche d'une API qui démarre :
`POST /api/auth/register` avec un email valide. Il traverse nginx, php-fpm,
Eloquent, la connexion Postgres et la migration.

---

## Retour arrière

1. `render deploys list <service-id>` pour identifier le dernier deploy sain.
2. Rollback par l'API ou le dashboard Render.
3. ⚠️ Une migration déjà appliquée sur Postgres **ne revient pas en arrière** avec
   le rollback du code : vérifier l'état réel avant de « restaurer », sinon on
   rejoue un bug corrigé. C'est la leçon du septembre 2026 sur agent-tutor.

---

## Pièges connus

- **`config/broadcasting.php` n'existe pas.** Le temps réel annoncé par le
  README n'existe pas côté API ; `laravel-echo` et `pusher-js` côté front ne
  peuvent rien recevoir. `BROADCAST_CONNECTION` reste donc inutile.
- **Comptes de test.** `finr.sql` est un dump **MySQL** : il ne s'importe pas
  dans Postgres. Les comptes `admin@finr.com` / `ingenieur@finr.com` du README
  n'existent donc pas sur une base neuve. `DatabaseSeeder` en crée d'autres
  (`a.kone@esp.sn` / `password`) — et n'est pas exécuté au déploiement.
- **`finr-nlp` garde son état en mémoire** (`_detectors`). Passer à plusieurs
  instances disperserait l'état de détection des événements entre conteneurs.
- **Plan `free`** : instance Postgres expirant à 30 jours, et mise en veille
  après inactivité (première requête lente au réveil).
