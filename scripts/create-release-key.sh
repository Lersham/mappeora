#!/bin/bash
# Creates the key that signs the Android app for Google Play, and prints the
# four values to save as GitHub secrets (Settings → Secrets and variables →
# Actions). Run it once, on your computer, outside the repository folder:
#
#   bash scripts/create-release-key.sh ~/mappeora-chiave
#
# Keep the folder it creates somewhere safe (e.g. a password manager): with
# Google Play App Signing this is only the "upload key", and Google can
# replace it if it is lost, but it is easier not to lose it.
set -euo pipefail

dir="${1:?Indica una cartella fuori dal repository, ad esempio ~/mappeora-chiave}"
mkdir -p "$dir"
keystore="$dir/mappeora-upload.jks"
if [ -e "$keystore" ]; then
  echo "Esiste già $keystore: non la sovrascrivo." >&2
  exit 1
fi

alias=mappeora
password="$(openssl rand -base64 24 | tr -d '/+=')"

keytool -genkeypair -keystore "$keystore" -storetype PKCS12 \
  -alias "$alias" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$password" -keypass "$password" \
  -dname "CN=Mappeora"

base64 -w0 "$keystore" > "$dir/MAPPEORA_KEYSTORE_BASE64.txt" 2>/dev/null ||
  base64 -i "$keystore" | tr -d '\n' > "$dir/MAPPEORA_KEYSTORE_BASE64.txt"
printf '%s' "$password" > "$dir/password.txt"
chmod 600 "$dir"/*

cat <<EOF

Fatto. Ora su GitHub: Settings → Secrets and variables → Actions → New repository secret.
Crea questi quattro secret:

  MAPPEORA_KEYSTORE_BASE64   il contenuto di $dir/MAPPEORA_KEYSTORE_BASE64.txt
  MAPPEORA_KEYSTORE_PASSWORD il contenuto di $dir/password.txt
  MAPPEORA_KEY_PASSWORD      lo stesso contenuto di $dir/password.txt
  MAPPEORA_KEY_ALIAS         $alias

Poi conserva la cartella $dir in un posto sicuro e non metterla nel repository.
EOF
