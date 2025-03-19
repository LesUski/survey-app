#!/bin/bash
# debug-lambda.sh

FUNCTION_NAME=$1
if [ -z "$FUNCTION_NAME" ]; then
  echo "Please provide a Lambda function name"
  exit 1
fi

echo "===== Function Configuration ====="
aws --endpoint-url=http://localhost:4566 lambda get-function --function-name $FUNCTION_NAME

echo "===== Recent Logs ====="
LOG_GROUP_NAME="/aws/lambda/$FUNCTION_NAME"
STREAMS=$(aws --endpoint-url=http://localhost:4566 logs describe-log-streams --log-group-name $LOG_GROUP_NAME --order-by LastEventTime --descending --limit 1 --query 'logStreams[0].logStreamName' --output text)

if [ "$STREAMS" != "None" ]; then
  aws --endpoint-url=http://localhost:4566 logs get-log-events --log-group-name $LOG_GROUP_NAME --log-stream-name $STREAMS --limit 100
else
  echo "No log streams found for $LOG_GROUP_NAME"
fi