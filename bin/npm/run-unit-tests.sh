#!/usr/bin/env sh

# bail out on any non-zero exit
set -e

BASEDIR=$(dirname "$0")

$BASEDIR/../../node_modules/.bin/nyc \
    --exclude='**/*.d.ts' \
    --exclude='**/*.interface.js' \
    --exclude='**/docs/javascript/*.js' \
    --exclude='src/common/helper/aws/*' \
    --exclude='src/sxp/error/*' \
    --exclude='build/src/*.js' \
    --exclude='build/tests/**/*.js' \
    --exclude='tests/**' \
    --exclude='.eslintrc.js' \
    --exclude='.prettierrc.js' \
    --exclude-after-remap=false \
    --all \
    --report-dir=coverage/unit \
    --reporter=lcov \
    --reporter=json \
    $BASEDIR/../../node_modules/.bin/_mocha --sort build/tests/unit.js $(find build/tests/*/unit -name '*.js')
