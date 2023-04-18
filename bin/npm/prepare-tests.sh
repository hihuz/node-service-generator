#!/usr/bin/env sh

# bail out on any non-zero exit
set -e

BASEDIR=$(dirname "$0")

rm -Rf $BASEDIR/../../build $BASEDIR/../../coverage/*

$BASEDIR/build-tests.sh
$BASEDIR/../../node_modules/.bin/tsc -p tsconfig-src-with-comments.json
