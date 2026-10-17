# ENV — FIN-R

Journal des variables d'environnement. Toute variable posée sur une
infrastructure doit être lue par le code, ou justifiée ici.

Règle appliquée : aucune valeur secrète n'est écrite dans ce fichier, et
`.env` n'est jamais committé (`finr-api/.gitignore`).

---

## `finr-api` (Laravel 12, service web Docker)

| Variable | Requise | Où elle est lue | Rôle |
|---|---|---|---|
| `APP_ENV` | oui | `config/app.php` | `production` sur Render. Doit **désactiver** la découverte d'extensionsdebug en prod. |
| `APP_KEY` | **oui** | `config/app.php` | Clé de chiffrement Laravel. Générée par `php artisan key:generate --show`. **Jamais régénérée en production** : cela invalide sessions et cookies. |
| `APP_DEBUG` | oui | `config/app.php` | `false` en production. À `true`, Whoops expose la pile d'appels et les variables d'env. |
| `APP_URL` | oui | `config/app.php` | URL publique du service, sert aux liens générés (PDF, redirections). |
| `DB_CONNECTION` | **oui** | `config/database.php` | `pgsql` en production. Le défaut du dépôt est `sqlite`, incompatible avec le système de fichiers éphémère de Render. |
| `DATABASE_URL` | **oui** | Render | URL Postgres **interne** fournie par Render. `entrypoint.sh` refuse de démarrer si elle est absente. |
| `JWT_SECRET` | **oui** | `config/jwt.php` | Clé HMAC de signature des JWT (`tymon/jwt-auth`). Générée par `php artisan jwt:secret`. Un secret régénéré invalide tous les tokens émis. |
| `FRONTEND_URL` | oui | `config/cors.php` | Origine exacte du front, seule autorisée par CORS. Doit être l'URL du site statique, pas `*`. |
| `NLP_SERVICE_URL` | oui | `app/Services/NlpService.php` | URL du microservice NLP. Défaut dépôt : `http://localhost:8001` — à remplacer par l'URL Render. |
| `LOG_CHANNEL` | oui | `config/logging.php` | `stderr` sur Render, sinon les logs n'apparaissent pas dans le dashboard. |
| `LOG_LEVEL` | oui | `config/logging.php` | `info` en production. |
| `SESSION_DRIVER` | oui | `config/session.php` | `database` (défaut dépôt). Ne jamais `file` : le disque est éphémère, les sessions disparaîtraient à chaque déploiement. |
| `CACHE_STORE` | oui | `config/cache.php` | `database` (défaut). |
| `QUEUE_CONNECTION` | oui | `config/queue.php` | `database` (défaut). **Aucun job n'est dispatché aujourd'hui** (`dispatch()` / `ShouldQueue` absents du code) : aucun worker n'est nécessaire. À revérifier si l'on ajoute un job. |
| `BROADCAST_CONNECTION` | non | `config/broadcasting.php` | Ignoré : **`config/broadcasting.php` n'existe pas dans le dépôt**. Le temps réel annoncé par le README n'est pas implémenté côté API. |

### Non lues par le code

| Variable | Statut |
|---|---|
| `APP_MAINTENANCE_DRIVER`, `MAIL_*`, `AWS_*`, `REDIS_*`, `MEMCACHED_*` | Valeurs par défaut de `.env.example`, jamais surchargées. Inertes : le projet n'envoie aucun mail, n'utilise ni S3 ni Redis ni Memcached. |

---

## `finr-nlp` (FastAPI, service web Python)

Aucune variable d'environnement requise. `app/main.py` ne lit pas `os.environ`.

À noter : les origines CORS sont codées en dur (`localhost:3000`, `localhost:8000`) mais **sans effet** — Laravel appelle ce service en serveur à serveur, jamais depuis le navigateur.

---

## `finr-app` (React 19 / Create React App, site statique)

| Variable | Requise | Où elle est lue | Rôle |
|---|---|---|---|
| `REACT_APP_API_URL` | **oui** | `src/lib/api.ts` | Base de l'API, ex. `https://finr-api-staging.onrender.com/api`. Lue **au build** : changer la variable exige un redéploiement. |
| `REACT_APP_REVERB_KEY` | non | `src/lib/echo.ts` | Non fonctionnel : `config/broadcasting.php` n'existe pas côté API. |
| `REACT_APP_REVERB_HOST` / `_PORT` | non | `src/lib/echo.ts` | Idem. |

---

## Machine locale (hors dépôt)

| Variable / fichier | Rôle |
|---|---|
| `php.ini` → `curl.cainfo`, `openssl.cafile` | Bundle CA. Doit contenir la racine **`Avast Web/Mail Shield Root`** : Avast intercepte le TLS et re-signe les certificats, donc sans elle PHP échoue sur tout HTTPS (`curl error 60`). Fichier construit : `cacert-local.pem`. Sauvegarde : `php.ini.bak`. |
| `php.ini` → `default_socket_timeout = 900` | Le défaut 60 s faisait échouer les téléchargements lents via Composer. |
