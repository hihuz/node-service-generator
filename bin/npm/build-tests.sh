#!/usr/bin/env sh

# bail out on any non-zero exit
set -e

BASEDIR=$(dirname "$0")

$BASEDIR/../../node_modules/.bin/tsc -p tsconfig-tests.json
