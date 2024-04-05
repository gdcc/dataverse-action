#!/bin/bash

set -euo pipefail

function usage() {
  echo "prepare.sh"
}

# If not present, default to creating temporary spaces
GITHUB_ENV=${GITHUB_ENV:-$(mktemp)}
RUNNER_TEMP=${RUNNER_TEMP:-$(mktemp -d)}

echo "GITHUB_ENV=${GITHUB_ENV}"
echo "RUNNER_TEMP=${RUNNER_TEMP}"

IMAGE_DATAVERSE=""
IMAGE_CONFIGBAKER=""
IMAGE_TAG=""
PG_VERSION=""
SOLR_VERSION=""
CONFIG_SUBDIR="dv/conf"

while getopts ":p:s:d:c:t:o:h" OPTION
do
  case "$OPTION" in
    p  ) PG_VERSION="$OPTARG" ;;
    s  ) SOLR_VERSION="$OPTARG" ;;
    d  ) IMAGE_DATAVERSE="$OPTARG" ;;
    c  ) IMAGE_CONFIGBAKER="$OPTARG" ;;
    t  ) IMAGE_TAG="$OPTARG" ;;
    o  ) CONFIG_SUBDIR="$OPTARG" ;;
    h  ) usage; exit 0;;
    \? ) echo "Unknown option: -$OPTARG" >&2; usage; exit 1;;
    :  ) echo "Missing option argument for -$OPTARG" >&2; usage; exit 1;;
    *  ) echo "Unimplemented option: -$OPTION" >&2; usage; exit 1;;
  esac
done
shift $((OPTIND-1))

# Check the basic things are here before we try to extract information from it
if [[ -z "${IMAGE_DATAVERSE}" ]]; then
  echo "Option -d for dataverse image location is mandatory"; exit 1
fi
if [[ -z "${IMAGE_CONFIGBAKER}" ]]; then
  echo "Option -c for configbaker image location is mandatory"; exit 1
fi
if [[ -z "${IMAGE_TAG}" ]]; then
  echo "Option -t for dataverse + configbaker image is mandatory"; exit 1
fi

# Get PostgreSQL version from action config or application image metadata, fail otherwise
PG_VERSION=${PG_VERSION:-$(docker inspect -f '{{ index .Config.Labels "org.dataverse.deps.postgresql.version"}}' "${IMAGE_DATAVERSE}:${IMAGE_TAG}")}
if [[ -z "${PG_VERSION}" ]]; then
  echo "Cannot find PostgreSQL version"; exit 1
else
  echo "POSTGRES_VERSION=$PG_VERSION" | tee -a "${GITHUB_ENV}"
fi

# Get Solr version from action config or application image metadata, fail otherwise
SOLR_VERSION="${SOLR_VERSION:-$(docker inspect -f '{{ index .Config.Labels "org.dataverse.deps.solr.version"}}' "${IMAGE_DATAVERSE#}:${IMAGE_TAG}")}"
if [[ -z "${SOLR_VERSION}" ]]; then
  echo "Cannot find Solr version"; exit 1
else
  echo "SOLR_VERSION=$SOLR_VERSION" | tee -a "${GITHUB_ENV}"
fi

echo "CONFIGBAKER_IMAGE=${IMAGE_CONFIGBAKER}:${IMAGE_TAG}" | tee -a "${GITHUB_ENV}"
echo "DATAVERSE_IMAGE=${IMAGE_DATAVERSE}:${IMAGE_TAG}" | tee -a "${GITHUB_ENV}"
echo "DATAVERSE_DB_USER=dataverse" | tee -a "${GITHUB_ENV}"
echo "DATAVERSE_DB_PASSWORD=secret" | tee -a "${GITHUB_ENV}"
echo "CONFIG_DIR=${RUNNER_TEMP}/${CONFIG_SUBDIR}" | tee -a "${GITHUB_ENV}"
