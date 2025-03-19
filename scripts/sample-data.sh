#!/bin/bash
set -e

echo "Creating sample data in LocalStack DynamoDB..."

# Set environment variables for LocalStack
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Get table names from CDK outputs
SURVEYS_TABLE=$(aws cloudformation describe-stacks --stack-name survey-app-dev --query "Stacks[0].Outputs[?OutputKey=='SurveysTableName'].OutputValue" --output text)
RESPONSES_TABLE=$(aws cloudformation describe-stacks --stack-name survey-app-dev --query "Stacks[0].Outputs[?OutputKey=='ResponsesTableName'].OutputValue" --output text)

# Create a sample survey
SURVEY_ID=$(uuidgen)
CURRENT_TIME=$(date +%s)

echo "Creating sample survey with ID: $SURVEY_ID"
aws dynamodb put-item \
  --table-name "$SURVEYS_TABLE" \
  --item '{
    "id": {"S": "'"$SURVEY_ID"'"},
    "ownerId": {"S": "sample-user"},
    "title": {"S": "Sample Survey"},
    "description": {"S": "This is a sample survey for local testing"},
    "questions": {"L": [
      {"M": {
        "id": {"S": "q1"},
        "text": {"S": "How do you rate this application?"},
        "type": {"S": "rating"},
        "required": {"BOOL": true},
        "options": {"NULL": true}
      }},
      {"M": {
        "id": {"S": "q2"},
        "text": {"S": "What features would you like to see?"},
        "type": {"S": "text"},
        "required": {"BOOL": false},
        "options": {"NULL": true}
      }},
      {"M": {
        "id": {"S": "q3"},
        "text": {"S": "Which category describes you best?"},
        "type": {"S": "select"},
        "required": {"BOOL": true},
        "options": {"L": [
          {"S": "Developer"},
          {"S": "Designer"},
          {"S": "Product Manager"},
          {"S": "Other"}
        ]}
      }}
    ]},
    "createdAt": {"N": "'"$CURRENT_TIME"'"},
    "updatedAt": {"N": "'"$CURRENT_TIME"'"},
    "status": {"S": "active"}
  }'

echo "Sample data created successfully!"
echo "Survey ID: $SURVEY_ID"
echo ""
echo "You can now test the API with this survey ID."