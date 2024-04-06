#!/usr/bin/env bash
# https://stackoverflow.com/questions/53619901/auto-create-s3-buckets-on-localstack
awslocal s3 mb s3://localstack
awslocal s3api put-bucket-cors --bucket localstack --cors-configuration file:///etc/localstack/init/ready.d/cors.json
