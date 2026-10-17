#!/usr/bin/env bash
#
# FIN-R API — point d'entrée du conteneur.
#
# Responsabilités, dans cet ordre :
#   1. refuser de démarrer si une variable requise manque (échec bruyant,
#      pas une erreur Laravel en production) ;
#   2. appliquer les migrations ;
#   3. mettre en cache la configuration et les routes ;
#   4. démarrer php-fpm puis nginx en avant-plan sur $PORT.
#
# composer n'est PAS exécuté ici : le vendor/ est déjà cuit dans l'image
# (cf. Dockerfile, étapes vendor + autoloader). Un démarrage ne dépend donc
# d'aucun accès réseau.

set -euo pipefail

cd "${APP_DIR:-/var/www/html}"

log() { echo "[entrypoint] $*"; }
die() { echo "[entrypoint] ERREUR: $*" >&2; exit 1; }

# ── 1. Variables requises ───────────────────────────────────────────────────
# Ni APP_KEY ni JWT_SECRET ne peuvent être générés à la volée : une clé
# regenerée au demarrage invaliderait les sessions et les JWT deja emis.
for var in APP_KEY JWT_SECRET DATABASE_URL DB_CONNECTION; do
    if [ -z "${!var:-}" ]; then
        die "variable d'environnement requise absente : $var"
    fi
done

# ── 2. Migrations ───────────────────────────────────────────────────────────
# Additives et idempotentes par construction (create_*). Sur plusieurs
# instances, Render ne lance qu'un conteneur a la fois pendant le deploiement ;
# le fichier de verrou SQLite n'intervient pas ici (on est sur Postgres).
log "application des migrations"
php artisan migrate --force --no-interaction

# ── 3. Caches Laravel ───────────────────────────────────────────────────────
# Après migrate, jamais avant : un config:cache fige les valeurs lues au boot.
log "mise en cache de la configuration et des routes"
php artisan config:cache --no-interaction
php artisan route:cache --no-interaction
php artisan view:cache --no-interaction

# ── 4. Nginx ────────────────────────────────────────────────────────────────
# envsubst ne doit substituer QUE $PORT. Sans liste explicite, envsubst
# remplacerait aussi les variables nginx ($uri, $fastcgi_script_name...)
# et la config deviendrait invalide.
log "generation de la config nginx sur le port ${PORT}"
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
rm -f /etc/nginx/sites-enabled/default

log "demarrage de php-fpm puis nginx"
php-fpm --daemonize
exec nginx -g 'daemon off;'
