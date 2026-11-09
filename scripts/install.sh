#!/bin/sh
# Installs DOC CLI from the npm registry after checking Node.js.
set -eu

PACKAGE="doc-cli-assistant"

if ! command -v node >/dev/null 2>&1
then
  echo "Node.js 22.13 or newer is required. Install it from https://nodejs.org and run this script again."
  exit 1
fi

MAJOR=$(node -p "process.versions.node.split('.')[0]")
MINOR=$(node -p "process.versions.node.split('.')[1]")
if [ "$MAJOR" -lt 22 ] || { [ "$MAJOR" -eq 22 ] && [ "$MINOR" -lt 13 ]; }
then
  echo "Found Node.js $(node -v). Version 22.13 or newer is required."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1
then
  echo "npm was not found. Reinstall Node.js from https://nodejs.org."
  exit 1
fi

echo "This will run: npm install -g $PACKAGE"
printf "Continue? [y/N] "
read -r answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) echo "Cancelled. Nothing was changed."; exit 0 ;;
esac

npm install -g "$PACKAGE"
echo "Installed. Open a new terminal and run: doc-cli doctor"
