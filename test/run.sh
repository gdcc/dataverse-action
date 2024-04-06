#!/usr/bin/env bash

set -euo pipefail

function usage() {
  echo "run.sh <start|stop> [-f <flavor compose file>] [-d] (debug)"
}

TEST_DIR=$(dirname "${0}")
TEST_ENVFILE_REF="$TEST_DIR/envfile_ref"

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

GITHUB_ENV=""
RUNNER_TEMP=""

if [[ -f "${TEST_ENVFILE_REF}" ]]; then
  # Reuse existing environment
  # shellcheck disable=SC1090
  . "${TEST_ENVFILE_REF}"
  export GITHUB_ENV
  export RUNNER_TEMP
  echo "🏕️  Reusing environment from $GITHUB_ENV and runner temp $RUNNER_TEMP"
else
  # Prepare the environment variables used in compose file
  GITHUB_ENV=$(mktemp)
  export GITHUB_ENV
  RUNNER_TEMP=$(mktemp -d)
  export RUNNER_TEMP

  # TODO: the image names probably should be not hardcoded
  "${TEST_DIR}/../scripts/prepare.sh" -d gdcc/dataverse -c gdcc/configbaker -t unstable
  echo "GITHUB_ENV=$GITHUB_ENV" > "$TEST_DIR/envfile_ref"
  echo "RUNNER_TEMP=$RUNNER_TEMP" >> "$TEST_DIR/envfile_ref"
fi

# Source the env vars we prepared
while read -r line; do
    line="$(echo "${line%%#*}" | xargs)"
    [ -n "$line" ] && export "${line?}"
done < "${GITHUB_ENV}"

if [[ "$ACTION" == "start" ]]; then
  # shellcheck disable=SC2086
  "${TEST_DIR}/../scripts/service.sh" -f ${FLAVOR_DIRECTORY} -p "apitest" "${DETACH_OPTION}" up
elif [[ "$ACTION" == "stop" ]]; then
  "${TEST_DIR}/../scripts/service.sh" -f ${FLAVOR_DIRECTORY} -p "apitest" "${DETACH_OPTION}" down
  rm -rf "$RUNNER_TEMP"
  rm "$GITHUB_ENV"
  rm "$TEST_ENVFILE_REF"
fi
