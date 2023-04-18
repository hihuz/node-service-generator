#!/usr/bin/env sh

# bail out on any non-zero exit
set -e

BASEDIR=$(dirname "$0")

# update npm binaries (docker system != host system)
npm rebuild --update-binary

# start the node monitor in debug mode
node ${BASEDIR}/../node_modules/nodemon/bin/nodemon.js --inspect=0.0.0.0:3002 -d 2 -w build/src build/src/index.js
