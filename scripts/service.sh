#!/bin/bash

set -euo pipefail

function usage() {
  echo "service.sh -p <project name> -f <flavor directory> [-d] <up|down>"
  echo "    -f: absolute or relative path to a flavor directory"
  echo "    -d: detach to background"
}

# See https://docs.github.com/en/actions/learn-github-actions/variables
GITHUB_ACTION_PATH=${GITHUB_ACTION_PATH:-"$(dirname "${0}")/.."}
GITHUB_WORKSPACE=${GITHUB_WORKSPACE:-""}

FLAVOR_DIRECTORY=""
DETACH_OPTION=""
PROJECT_OPTION=""

while getopts ":f:p:dh" OPTION
do
  case "$OPTION" in
    p  ) PROJECT_OPTION="$OPTARG" ;;
    f  ) FLAVOR_DIRECTORY="$OPTARG"; ;;
    d  ) DETACH_OPTION="-d" ;;
    h  ) usage; exit 0;;
    \? ) echo "Unknown option: -$OPTARG" >&2; usage; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; usage; exit 1;;
    *  ) echo "Unimplemented option: -$OPTION" >&2; usage; exit 1;;
  esac
done
shift $((OPTIND-1))

ACTION=${1:-invalid}
ACTION_OPTION=""
if [[ "$ACTION" == "up" ]]; then
  ACTION_OPTION=" up --quiet-pull ${DETACH_OPTION}"
elif [[ "$ACTION" == down ]]; then
  ACTION_OPTION=" down -v"
else
  echo "Unsupported action '$ACTION'. Must be 'up' or 'down'"; exit 1
fi

FLAVOR_COMPOSE_FILE=""
# Let's try an absolute path first
if [[ "${FLAVOR_DIRECTORY:0:1}" == / && -f "${FLAVOR_DIRECTORY}/compose.yml" ]]; then
  FLAVOR_COMPOSE_FILE=$(realpath "${FLAVOR_DIRECTORY}/compose.yml")
# Maybe it's a relative path in the users repo?
elif [[ -f "${GITHUB_WORKSPACE}/.github/dataverse-action/${FLAVOR_DIRECTORY}/compose.yml" ]]; then
  FLAVOR_COMPOSE_FILE=$(realpath "${GITHUB_WORKSPACE}/${FLAVOR_DIRECTORY}/compose.yml")
# Maybe it's a relative path within the action?
elif [[ -f "${GITHUB_ACTION_PATH}/${FLAVOR_DIRECTORY}/compose.yml" ]]; then
  FLAVOR_COMPOSE_FILE=$(realpath "${GITHUB_ACTION_PATH}/${FLAVOR_DIRECTORY}/compose.yml")
# Last chance: a file within the current directory?
elif [[ -f "$(pwd)/${FLAVOR_DIRECTORY}/compose.yml" ]]; then
  FLAVOR_COMPOSE_FILE=$(realpath "$(pwd)/${FLAVOR_DIRECTORY}/compose.yml")
fi

FLAVOR_FILE_OPTION=""
if [[ ! -z "${FLAVOR_COMPOSE_FILE}" ]]; then
  echo "🌶️  Using flavor compose file at ${FLAVOR_COMPOSE_FILE}"
  FLAVOR_FILE_OPTION="-f ${FLAVOR_COMPOSE_FILE}"
fi

# shellcheck disable=SC2086
docker compose -f "${GITHUB_ACTION_PATH}/docker-compose.yml" ${FLAVOR_FILE_OPTION} -p "${PROJECT_OPTION}" ${ACTION_OPTION}

if [[ "$ACTION" == "up" ]]; then
  echo -e "✅️ Dataverse containers have been started."
fi
