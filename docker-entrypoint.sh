#!/bin/sh
set -e

# Uploads-Verzeichnis im gemeinsamen Volume anlegen und verlinken
mkdir -p /data/assets
ln -sfn /data/assets /app/public/uploads

exec node server.js
