#!/bin/bash

echo "🚀 Retrieving API Token"

# Set variables
export BUILTIN_USERS_KEY="burrito"
export PASSWORD="TEST123!"
export HOST="http://localhost:8080"

# Set the builtin user key
curl -X PUT \
    -o /dev/null \
    -d $BUILTIN_USERS_KEY \
    --silent \
    $HOST/api/admin/settings/BuiltinUsers.KEY &&
    echo "├─ BuiltinUsers.KEY set"

# Create a user and receive the API Token
curl -d @./assets/user.json \
    -o ./user_data.json \
    -H "Content-type:application/json" \
    --silent \
    "$HOST/api/builtin-users?password=$PASSWORD*&key=$BUILTIN_USERS_KEY" &&
    echo "├─ User created"

# Retrieve the API Token and put into env variable
API_TOKEN=$(echo $(cat ./user_data.json) | jq -r '.data.apiToken')
echo "API_TOKEN=$API_TOKEN" >>$GITHUB_ENV

echo -e "✅ API Token added to environment\n"
