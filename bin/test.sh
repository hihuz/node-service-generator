#!/usr/bin/env sh

# bail out on any non-zero exit
set -e

BASEDIR=$(dirname "$0")

# exit if there are known vulnerabilities
npm audit || exit $?

# clear previous coverage reports
rm -Rf ./coverage/*

# start unit tests
npm run run-unit-tests

# generate combined reports and check coverage
npm run combined-coverage

# give us some time to save the coverage reports
sleep 1

exit $?
