#!/usr/bin/env bash

set -euo pipefail

function usage() {
  echo "run.sh <start|stop> [-f <flavor compose file>] [-d] (debug)"
}

TEST_DIR=$(dirname "${0}")

GITHUB_ENV=$(mktemp)
export GITHUB_ENV
RUNNER_TEMP=$(mktemp -d)
export RUNNER_TEMP

# Get action and check for validity
ACTION=${1:-"invalid"}
shift # Must shift here to enable getopts!
if ! [[ "$ACTION" == "start" || "$ACTION" == "stop" ]]; then
  echo "First parameter must be 'start' or 'stop'" >&2; exit 1
fi

FLAVOR_DIRECTORY=""
DETACH_OPTION="-d"

while getopts ":f:dh" OPTION
do
  case "$OPTION" in
    f  ) FLAVOR_DIRECTORY="$OPTARG" ;;
    d  ) DETACH_OPTION="" ;;
    h  ) usage; exit 0;;
    \? ) echo "Unknown option: -$OPTARG" >&2; usage; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; usage; exit 1;;
    *  ) echo "Unimplemented option: -$OPTION" >&2; usage; exit 1;;
  esac
done
shift $((OPTIND-1))

# Prepare the environment variables used in compose file
# TODO: the image names probably should be not hardcoded
"${TEST_DIR}/../scripts/prepare.sh" -d gdcc/dataverse -c gdcc/configbaker -t unstable

# Source the env vars we prepared
while read -r line; do
    line="$(echo "${line%%#*}" | xargs)"
    [ -n "$line" ] && export "${line?}"
done < "${GITHUB_ENV}"

if [[ "$ACTION" == "start" ]]; then
  # shellcheck disable=SC2086
  "${TEST_DIR}/../scripts/service.sh" -f ${FLAVOR_DIRECTORY} -p "apitest" "${DETACH_OPTION}" up
elif [[ "$ACTION" == "stop" ]]; then
  # shellcheck disable=SC2086
  docker compose -f "$TEST_DIR/../docker-compose.yml" ${FLAVOR_FILE_OPTION} -p "apitest" down -v
  "${TEST_DIR}/../scripts/service.sh" -f ${FLAVOR_DIRECTORY} -p "apitest" "${DETACH_OPTION}" down
fi
