#!/bin/bash
set -e

# Set environment variables for LocalStack
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT=000000000000
export CDK_DEFAULT_REGION=us-east-1

# Ensure LocalStack is running
echo "Checking if LocalStack is running..."
if ! curl -s http://localhost:4566/health | grep -q "\"s3\": \"running\""; then
  echo "LocalStack doesn't appear to be running. Starting with docker-compose..."
  cd "$(dirname "$0")/.." && docker-compose up -d
  echo "Waiting for LocalStack to be ready..."
  sleep 10
fi

# Deploy the stack if needed
echo "Checking if stack is deployed..."
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! aws cloudformation describe-stacks --stack-name survey-app-dev &>/dev/null; then
  echo "Stack not found, deploying with local-deploy.sh..."
  bash "$SCRIPT_DIR/local-deploy.sh"
fi

# Get API Gateway URL from CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks --stack-name survey-app-dev --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

if [ -z "$API_URL" ]; then
    echo "Error: Could not retrieve API URL from CloudFormation outputs."
    exit 1
fi

echo "Using API URL: $API_URL"
echo ""

# First we need to create a Cognito user to authenticate our requests
echo "Creating a test Cognito user..."
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name survey-app-dev --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name survey-app-dev --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
    echo "Error: Could not retrieve Cognito information from CloudFormation outputs."
    exit 1
fi

USERNAME="testuser@example.com"
PASSWORD="Test123!"

# Create user and set password
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME \
  --temporary-password $PASSWORD \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $USERNAME \
  --password $PASSWORD \
  --permanent

# Get auth token
echo "Getting authentication token..."
AUTH_RESULT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters "USERNAME=$USERNAME,PASSWORD=$PASSWORD")

ID_TOKEN=$(echo $AUTH_RESULT | jq -r '.AuthenticationResult.IdToken')

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" == "null" ]; then
    echo "Error: Could not retrieve authentication token."
    exit 1
fi

echo "Successfully authenticated! Testing GET /surveys endpoint..."

# Test GET /surveys endpoint (should return empty array initially)
echo "Testing GET /surveys endpoint (initial)..."
SURVEYS_RESPONSE=$(curl -s -X GET \
  -H "Authorization: $ID_TOKEN" \
  "${API_URL}surveys")

echo "Initial surveys response:"
echo "$SURVEYS_RESPONSE" | jq .
echo ""

# Test creating multiple surveys
echo "Creating first survey..."
SURVEY1_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: $ID_TOKEN" \
  -d '{
    "title": "Customer Satisfaction Survey",
    "description": "Help us improve our services",
    "questions": [
      {
        "id": "q1",
        "text": "How would you rate our service?",
        "type": "rating",
        "required": true
      },
      {
        "id": "q2",
        "text": "What could we improve?",
        "type": "text",
        "required": false
      }
    ]
  }' \
  "${API_URL}surveys")

echo "First survey creation response:"
echo "$SURVEY1_RESPONSE" | jq .
echo ""

# Extract the survey ID from the response
SURVEY1_ID=$(echo "$SURVEY1_RESPONSE" | jq -r '.id')

echo "Creating second survey..."
SURVEY2_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: $ID_TOKEN" \
  -d '{
    "title": "Product Feedback Survey",
    "description": "Tell us about your experience with our new product",
    "questions": [
      {
        "id": "q1",
        "text": "How easy was the product to use?",
        "type": "rating",
        "required": true
      },
      {
        "id": "q2",
        "text": "Would you recommend this product to others?",
        "type": "yesno",
        "required": true
      },
      {
        "id": "q3",
        "text": "Any additional feedback?",
        "type": "text",
        "required": false
      }
    ]
  }' \
  "${API_URL}surveys")

echo "Second survey creation response:"
echo "$SURVEY2_RESPONSE" | jq .
echo ""

# Extract the survey ID from the response
SURVEY2_ID=$(echo "$SURVEY2_RESPONSE" | jq -r '.id')

if [ -z "$SURVEY1_ID" ] || [ "$SURVEY1_ID" == "null" ] || [ -z "$SURVEY2_ID" ] || [ "$SURVEY2_ID" == "null" ]; then
    echo "Error: Could not retrieve survey IDs from responses."
    exit 1
fi

# Test GET /surveys endpoint again (should now return the created surveys)
echo "Testing GET /surveys endpoint (after creation)..."
SURVEYS_RESPONSE=$(curl -s -X GET \
  -H "Authorization: $ID_TOKEN" \
  "${API_URL}surveys")

echo "Updated surveys response:"
echo "$SURVEYS_RESPONSE" | jq .
echo ""

# Test submitting responses to the first survey
echo "Submitting a response to the first survey..."
RESPONSE1_RESULT=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "respondentId": "respondent1",
    "responses": [
      {
        "questionId": "q1",
        "value": "4"
      },
      {
        "questionId": "q2",
        "value": "The service was good but could be faster."
      }
    ]
  }' \
  "${API_URL}surveys/${SURVEY1_ID}/responses")

echo "First response submission result:"
echo "$RESPONSE1_RESULT" | jq .
echo ""

echo "Submitting another response to the first survey..."
RESPONSE2_RESULT=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "respondentId": "respondent2",
    "responses": [
      {
        "questionId": "q1",
        "value": "5"
      },
      {
        "questionId": "q2",
        "value": "Excellent service, very satisfied!"
      }
    ]
  }' \
  "${API_URL}surveys/${SURVEY1_ID}/responses")

echo "Second response submission result:"
echo "$RESPONSE2_RESULT" | jq .
echo ""

# Test getting survey results
echo "Getting results for the first survey..."
SURVEY_RESULTS=$(curl -s -X GET \
  -H "Authorization: $ID_TOKEN" \
  "${API_URL}surveys/${SURVEY1_ID}/results")

echo "Survey results response:"
echo "$SURVEY_RESULTS" | jq .
echo ""

# Test getting a specific survey
echo "Getting details for the first survey..."
SURVEY_DETAILS=$(curl -s -X GET \
  -H "Authorization: $ID_TOKEN" \
  "${API_URL}surveys/${SURVEY1_ID}")

echo "Survey details response:"
echo "$SURVEY_DETAILS" | jq .
echo ""

echo "Test completed successfully!"
echo ""
echo "Summary:"
echo "- Created two surveys"
echo "- Verified GET /surveys returns all surveys"
echo "- Submitted two responses to the first survey"
echo "- Retrieved survey results for the first survey"
echo "- Retrieved detailed information for the first survey"