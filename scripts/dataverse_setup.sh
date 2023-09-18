#!/bin/bash

echo "🚀 Setting up Dataverse"

# Create host address
export HOST="http://localhost:8080"

# Clone the dataverse repository and cd into it
git clone -b develop https://github.com/IQSS/dataverse.git

cd dataverse

# Run API containers
docker compose -f ../docker-compose-dataverse.yml \
    --env-file ../.env.dataverse \
    up -d --quiet-pull && echo -e "✅ Dataverse containers are up\n"

cd ../
