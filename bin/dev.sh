#!/usr/bin/env sh

set -e

BASEDIR=$(dirname "$0")

npm run create-db
npm run generate-fixtures

node ${BASEDIR}/../node_modules/nodemon/bin/nodemon.js --inspect -w build/src build/src/examples/index.js
