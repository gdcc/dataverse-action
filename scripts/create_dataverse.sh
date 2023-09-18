echo "🚀 Creating Test Dataverse"

curl -H "X-Dataverse-key:$API_TOKEN" \
    --silent \
    -X POST "localhost:8080/api/dataverses/1" \
    --upload-file ./assets/dataverse-complete.json
