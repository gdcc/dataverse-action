echo "🚀 Health checks"

./scripts/wait_for_url.sh \
    "http://localhost:8080/api/info/version" \
    "http://localhost:8080/api/metadatablocks" \
    "http://localhost:8080/api/metadatablocks/citation" \
    "http://localhost:8080/api/dataverses/root"

echo -e "✅ Health checks done\n"
