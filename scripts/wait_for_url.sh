#!/bin/bash

##############################################################################################
#
# Credits: https://gist.github.com/eisenreich/195ab1f05715ec86e300f75d007d711c
#
# Wait for URLs until return HTTP 200
#
# - Just pass as many urls as required to the script - the script will wait for each, one by one
#
# Example: ./wait_for_urls.sh "${MY_VARIABLE}" "http://192.168.56.101:8080"
##############################################################################################

wait-for-url() {
    echo -e "├─ Waiting for ${1}"
    timeout --foreground -s TERM 280s bash -c \
        'while [[ "$(curl -s -o /dev/null -m 3 -L -w ''%{http_code}'' ${0})" != "200" ]];\
        do sleep 20;\
        done' ${1}
    local TIMEOUT_RETURN="$?"
    if [[ "${TIMEOUT_RETURN}" == 0 ]]; then
        echo -e "├─ Endpoint is up"
        return
    elif [[ "${TIMEOUT_RETURN}" == 120000 ]]; then
        echo "├─ Timeout: ${1} -> EXIT"
        exit "${TIMEOUT_RETURN}"
    fi

}

for var in "$@"; do
    wait-for-url "$var"
done
