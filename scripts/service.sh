#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(dirname "${0}")
COMPOSE_FILE=""
FILE_OPTION=""
DETACH_OPTION=""
PROJECT_OPTION=""

while getopts ":f:p:dh" OPTION
do
  case "$OPTION" in
    p  ) PROJECT_OPTION="$OPTARG" ;;
    f  ) COMPOSE_FILE="$OPTARG"; FILE_OPTION="-f ${COMPOSE_FILE}" ;;
    d  ) DETACH_OPTION="-d" ;;
    h  ) usage; exit 0;;
    \? ) echo "Unknown option: -$OPTARG" >&2; usage; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; usage; exit 1;;
    *  ) echo "Unimplemented option: -$OPTION" >&2; usage; exit 1;;
  esac
done
shift $((OPTIND-1))

# shellcheck disable=SC2086
docker compose -f "${SCRIPT_DIR}/../docker-compose.yml" ${FILE_OPTION} \
    -p "${PROJECT_OPTION}" up ${DETACH_OPTION} --quiet-pull

echo -e "✅️ Dataverse containers have been started."
