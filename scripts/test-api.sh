#!/bin/bash
set -e

echo "🧪 Testing survey API on LocalStack..."

# Set LocalStack environment variables
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Get the API endpoint from CloudFormation outputs
echo "Retrieving API endpoint from CloudFormation outputs..."
API_ENDPOINT=$(aws --endpoint-url=http://localhost:4566 cloudformation describe-stacks --stack-name SurveyApp-dev --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

# Remove trailing slash if present
API_ENDPOINT=${API_ENDPOINT%/}

echo "API Endpoint: $API_ENDPOINT"

# Generate a mock API key for testing
MOCK_API_KEY="test-api-key-local-xyz-753"
echo "Using API Key: $MOCK_API_KEY"

# Mock user ID for testing
MOCK_USER_ID="test-user-$(date +%s)"
echo "Using User ID: $MOCK_USER_ID"

# Get a survey ID from the DynamoDB table for testing
SURVEYS_TABLE=$(aws --endpoint-url=http://localhost:4566 cloudformation describe-stacks --stack-name SurveyApp-dev --query "Stacks[0].Outputs[?OutputKey=='SurveysTableName'].OutputValue" --output text)

# Check if there are any surveys in the table
SURVEY_COUNT=$(aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name "$SURVEYS_TABLE" --select "COUNT" --query "Count" --output text)

if [ "$SURVEY_COUNT" -gt 0 ]; then
  SURVEY_ID=$(aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name "$SURVEYS_TABLE" --limit 1 --query "Items[0].surveyId.S" --output text)
  echo "Using existing Survey ID for testing: $SURVEY_ID"
else
  # Create a sample survey if none exists
  echo "No surveys found, creating a sample survey..."
  SURVEY_ID="test-survey-$(date +%s)"
  
  aws --endpoint-url=http://localhost:4566 dynamodb put-item \
    --table-name "$SURVEYS_TABLE" \
    --item '{
      "surveyId": {"S": "'"$SURVEY_ID"'"},
      "title": {"S": "Test Survey"},
      "description": {"S": "Created by test script"},
      "questions": {"L": [
        {"M": {
          "id": {"S": "q1"},
          "text": {"S": "Test Question 1"},
          "type": {"S": "text"},
          "required": {"BOOL": true}
        }}
      ]},
      "ownerId": {"S": "'"$MOCK_USER_ID"'"},
      "createdAt": {"S": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"},
      "updatedAt": {"S": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"},
      "isActive": {"BOOL": true},
      "isPublic": {"BOOL": true},
      "responseCount": {"N": "0"}
    }'
  
  echo "Created sample Survey ID: $SURVEY_ID"
fi

# Function to make API requests and display results
function test_endpoint() {
    local method=$1
    local endpoint=$2
    local payload=$3
    local description=$4
    
    echo "---------------------------------------------"
    echo "🔍 $description"
    echo "📍 $method $endpoint"
    
    if [ -n "$payload" ]; then
        echo "📦 Payload: $payload"
        response=$(curl -s -X "$method" "$endpoint" \
          -H "Content-Type: application/json" \
          -H "x-api-key: $MOCK_API_KEY" \
          -H "x-user-id: $MOCK_USER_ID" \
          -d "$payload")
    else
        response=$(curl -s -X "$method" "$endpoint" \
          -H "x-api-key: $MOCK_API_KEY" \
          -H "x-user-id: $MOCK_USER_ID")
    fi
    
    # Check if response is valid JSON
    if echo "$response" | jq . &>/dev/null; then
        echo "✅ Response:"
        echo "$response" | jq .
    else
        echo "❌ Response (not JSON):"
        echo "$response"
    fi
    echo "---------------------------------------------"
    echo ""
}

# Test various API endpoints
echo "Starting API tests..."

# 1. Create a new survey
NEW_SURVEY_PAYLOAD='{
  "title": "API Test Survey",
  "description": "Created via test API script",
  "questions": [
    {
      "id": "q1",
      "text": "How would you rate this test?",
      "type": "rating",
      "required": true
    },
    {
      "id": "q2",
      "text": "Any feedback on the testing process?",
      "type": "text",
      "required": false
    }
  ],
  "isActive": true,
  "isPublic": true
}'
test_endpoint "POST" "$API_ENDPOINT/surveys" "$NEW_SURVEY_PAYLOAD" "Creating a new survey"

# 2. Get all surveys
test_endpoint "GET" "$API_ENDPOINT/surveys" "" "Getting all surveys"

# 3. Get a specific survey
test_endpoint "GET" "$API_ENDPOINT/surveys/$SURVEY_ID" "" "Getting a specific survey"

# 4. Submit a response to a survey
RESPONSE_PAYLOAD='{
  "answers": [
    {
      "questionId": "q1",
      "value": "5"
    },
    {
      "questionId": "q2",
      "value": "Great test framework!"
    }
  ],
  "metadata": {
    "source": "api-test",
    "testId": "automated-test"
  }
}'
test_endpoint "POST" "$API_ENDPOINT/surveys/$SURVEY_ID/responses" "$RESPONSE_PAYLOAD" "Submitting a survey response"

# 5. Get survey results
test_endpoint "GET" "$API_ENDPOINT/surveys/$SURVEY_ID/results" "" "Getting survey results"

echo "✅ API testing complete!"