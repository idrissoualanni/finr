# syntax=docker/dockerfile:1
#
# FIN-R API — image de production Laravel 12 + nginx + php-fpm
#
# Render n'a pas de runtime PHP natif : l'API passe donc par Docker.
# L'endpoint de santé est /up (Laravel 12, cf. bootstrap/app.php) — c'est le
# health check configuré sur le service Render.
#
# Les dépendances sont cuites dans l'image (étape vendor/autoloader) : le
# conteneur ne lance PAS composer au démarrage, donc le démarrage est
# rapide et reproductible.

# ── Étape 1 : dépendances PHP (vendor/) ─────────────────────────────────────
# L'étape est sur php:8.2-cli et NON sur composer:2.8 : l'image composer
# embarque PHP 8.4, et le lock est lié à PHP ~8.1||~8.2 (lcobucci/clock).
# Résoudre le lock sous un autre PHP fait échouer le build alors que le
# runtime, lui, est bien en 8.2. Seul le binaire composer est emprunte
# a l'image officielle.
FROM php:8.2-cli-bookworm AS vendor

COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# unzip : sans lui (ni extension zip), Composer ne peut pas extraire les
#         zipballs et bascule tout le lock en source.
# git    : rend ce repli source réellement possible au lieu de faire echouer
#         le build sur "git was not found in your PATH".
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends git unzip; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Le lock seul suffit à résoudre les versions : on copie avant le code source
# pour que la couche soit réutilisée tant que composer.lock ne bouge pas.
COPY composer.json composer.lock ./

RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction \
        --no-progress

# ── Étape 2 : autoloader optimisé ────────────────────────────────────────────
# On refait l'autoloader APRÈS avoir copié le code applicatif pour produire un
# classmap complet (recherche par classe au lieu de lecture fichier à la volée).
# Même base PHP que l'étape vendor, pour la même raison.
FROM php:8.2-cli-bookworm AS autoloader

COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY composer.json composer.lock ./
COPY app ./app
# database/ est copie pour que le classmap couvre aussi les factories et
# seeders declares dans composer.json (sinon ils seraient introuvables).
COPY database ./database

RUN composer dump-autoload \
        --no-dev \
        --optimize \
        --classmap-authoritative \
        --no-scripts

# ── Étape 3 : runtime nginx + php-fpm ────────────────────────────────────────
FROM php:8.2-fpm-bookworm

# Paquets de build. PAS de purge --auto-remove ensuite : les bibliothèques
# partagées que ces extensions lient (libpq5, libzip4, libicu, libcurl4,
# libonig5, libpng…) sont installées comme dépendances "auto" des paquets -dev,
# donc un purge les emporterait. L'image se construirait puis le conteneur
# mourrait au premier import sur un "symbol lookup error". Le cout est une
# image plus volumineuse ; l'economie n'en vaut pas le risque.
# libpq-dev est obligatoire : sans pg_config ni libpq-fe.h, pdo_pgsql ne
# compile pas.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        nginx \
        gettext-base \
        libpq-dev \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libicu-dev \
        libxml2-dev \
        libcurl4-openssl-dev \
        libonig-dev \
        zlib1g-dev; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        pdo_pgsql \
        pdo_mysql \
        mbstring \
        dom \
        simplexml \
        xml \
        xmlwriter \
        curl \
        zip \
        bcmath \
        gd \
        intl \
        opcache \
        pcntl; \
    rm -rf /var/lib/apt/lists/*

COPY docker/php-production.ini /usr/local/etc/php/conf.d/zz-production.ini
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

WORKDIR /var/www/html

# Code applicatif + vendor optimisé (le vendor_local n'est pas versionné :
# il est produit par l'étape autoloader).
COPY --chown=www-data:www-data . .
COPY --from=autoloader --chown=www-data:www-data /app/vendor ./vendor

# Laravel a besoin d'écrire dans storage/ et bootstrap/cache/ au runtime.
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Document root : le projet est à la racine, l'entrée publique est /public.
ENV APP_DIR=/var/www/html

# Render injecte PORT (10000 par defaut) et attend que le service ecoute ce
# port. EXPOSE est documentaire : c'est nginx qui ecoute reellement $PORT.
EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/entrypoint"]
