#!/bin/bash

set -euo pipefail

RUNNER_TEMP=${RUNNER_TEMP:?Must define RUNNER_TEMP env variable before running this script}
CONFIGBAKER_IMAGE=${CONFIGBAKER_IMAGE:?Must define CONFIGBAKER_IMAGE env variable before running this script}
GITHUB_OUTPUT=${GITHUB_OUTPUT:-$(mktemp)}

mkdir -p "${RUNNER_TEMP}/dv"
touch "${RUNNER_TEMP}/dv/bootstrap.exposed.env"

echo "::group::🤖 Bootstrap Dataverse service"

docker run -i --network apitest_dataverse \
  -v "${RUNNER_TEMP}/dv/bootstrap.exposed.env:/.env" \
  "${CONFIGBAKER_IMAGE}" bootstrap.sh -e /.env dev

echo "::endgroup::"

# Expose outputs
grep "API_TOKEN" "${RUNNER_TEMP}/dv/bootstrap.exposed.env" >> "$GITHUB_OUTPUT"
echo "base_url=http://localhost:8080/" >> "$GITHUB_OUTPUT"

# Expose version
version=$(curl -s 'http://localhost:8080/api/info/version' | jq -r '.data.version')
echo "dv_version=$version" >>"$GITHUB_OUTPUT"

echo "🎉 Your Dataverse instance is ready to go!"
