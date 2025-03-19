# Survey App

A serverless application for creating and managing surveys, built with AWS CDK and TypeScript.

## Architecture

The application uses the following AWS services:
- **Amazon DynamoDB** - for storing surveys and responses
- **AWS Lambda** - for serverless API handlers
- **Amazon API Gateway** - for the REST API
- **Amazon Cognito** - for authentication (optional, supports local API Key authentication)
- **AWS CDK** - for infrastructure as code

### Data Models

The application uses [Dynamoose](https://dynamoosejs.com/) as an ORM for DynamoDB with the following models:

#### Survey Model
```typescript
// Survey model for storing survey information
interface Survey {
  surveyId: string;           // Primary key
  title: string;              // Survey title
  description?: string;       // Optional description
  questions: Question[];      // Array of question objects
  ownerId: string;            // User ID of survey creator
  createdAt: string;          // Creation timestamp
  updatedAt: string;          // Last update timestamp
  isActive: boolean;          // Whether survey is accepting responses
  isPublic: boolean;          // Whether survey is publicly viewable
  responseCount: number;      // Number of responses received
  settings?: SurveySettings;  // Optional survey settings
}
```

#### Question Types
The application supports various question types:

```typescript
enum QuestionType {
  TEXT = 'text',              // Free text response
  MULTIPLE_CHOICE = 'multiple_choice', // Select one option
  CHECKBOX = 'checkbox',      // Select multiple options
  RATING = 'rating',          // Numeric rating (e.g., 1-5)
  DATE = 'date',              // Date selection
  EMAIL = 'email',            // Email input
  NUMBER = 'number',          // Numeric input
}
```

#### Survey Settings
Customization options for surveys:

```typescript
interface SurveySettings {
  allowAnonymous?: boolean;    // Allow responses without authentication
  showProgressBar?: boolean;   // Show progress during survey
  showQuestionNumbers?: boolean; // Show question numbers
  confirmationMessage?: string; // Message shown after submission
  redirectUrl?: string;        // URL to redirect after completion
  theme?: string;              // Visual theme
  customCss?: string;          // Custom styling
}
```

#### Response Model
```typescript
// Response model for storing survey responses
interface Response {
  responseId: string;        // Primary key
  surveyId: string;          // Survey ID (indexed for queries)
  answers: Answer[];         // Array of answer objects
  respondentId?: string;     // Optional user ID of respondent
  submittedAt: string;       // Submission timestamp
  metadata?: object;         // Optional metadata
  ipAddress?: string;        // IP address of respondent
  userAgent?: string;        // User agent of respondent
}

// Answer structure
interface Answer {
  questionId: string;        // ID of the question
  value: string | string[];  // Answer value (string or array for multi-select)
}
```

## Local Development

You can run the app locally using LocalStack, which simulates AWS services on your local machine.

### Prerequisites

- Node.js and npm
- Docker and Docker Compose
- AWS CLI

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start LocalStack:
```bash
npm run localstack:start
```

3. Deploy the app to LocalStack:
```bash
npm run localstack:deploy
```

4. Add sample data:
```bash
npm run localstack:sample-data
```

5. Test the API:
```bash
./scripts/test-api.sh
```

To run all the setup steps together:
```bash
npm run dev
```

### Available Scripts

- `npm run localstack:start` - Start LocalStack containers
- `npm run localstack:stop` - Stop LocalStack containers
- `npm run localstack:deploy` - Deploy the stack to LocalStack
- `npm run localstack:sample-data` - Create sample data in DynamoDB
- `npm run localstack:logs` - View LocalStack logs
- `npm run dev` - Start the app locally in development mode (runs start, deploy, and sample-data)

## API Reference

The Survey App provides a RESTful API for managing surveys and responses. Authentication is handled through either:
- API Key (for LocalStack development)
- Cognito User Pools (for production)

### API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|--------------|
| `POST` | `/surveys` | Create a new survey | Yes |
| `GET` | `/surveys` | List all surveys (filtered by ownership/public) | Optional |
| `GET` | `/surveys/{surveyId}` | Get a specific survey | Optional |
| `POST` | `/surveys/{surveyId}` | Update a survey | Yes |
| `POST` | `/surveys/{surveyId}/responses` | Submit a response to a survey | No |
| `GET` | `/surveys/{surveyId}/results` | Get survey results | Yes |

### Request/Response Examples

#### Create Survey
```json
// POST /surveys
// Request
{
  "title": "Customer Satisfaction Survey",
  "description": "Please tell us about your experience",
  "questions": [
    {
      "id": "q1",
      "text": "How would you rate our service?",
      "type": "rating",
      "required": true
    },
    {
      "id": "q2",
      "text": "Any additional comments?",
      "type": "text",
      "required": false
    }
  ],
  "isPublic": true
}

// Response
{
  "surveyId": "abc123",
  "title": "Customer Satisfaction Survey",
  "description": "Please tell us about your experience",
  "questions": [...],
  "ownerId": "user123",
  "createdAt": "2025-03-14T12:00:00.000Z",
  "updatedAt": "2025-03-14T12:00:00.000Z",
  "isActive": true,
  "isPublic": true,
  "responseCount": 0
}
```

#### Submit Response
```json
// POST /surveys/{surveyId}/responses
// Request
{
  "answers": [
    {
      "questionId": "q1",
      "value": "5"
    },
    {
      "questionId": "q2",
      "value": "Great service, very satisfied!"
    }
  ],
  "metadata": {
    "source": "website",
    "device": "mobile"
  }
}

// Response
{
  "message": "Survey response submitted successfully",
  "responseId": "resp456"
}
```

You can test the API using the provided test script:
```bash
./scripts/test-api.sh
```

## Authentication & Security

The application supports two authentication methods:

### 1. API Key Authentication (LocalStack Development)

For local development with LocalStack, API Key authentication is used:
- API keys are created and managed through API Gateway
- The key is included in the `x-api-key` header for all authenticated requests
- For testing with LocalStack, the `x-user-id` header can be used to simulate authenticated users

### 2. Amazon Cognito (Production)

For production deployment:
- User authentication is handled through Amazon Cognito User Pools
- JWT tokens from Cognito are passed in the `Authorization` header
- User permissions are based on the Cognito user ID
- API Gateway validates tokens before passing requests to Lambda functions

### Security Features

- **Input Validation**: All input data is validated before processing
- **Permission Controls**: Users can only access and modify their own surveys
- **Anonymous Responses**: Support for anonymous survey responses when enabled
- **CORS Configuration**: API Gateway is configured with proper CORS headers

## LocalStack-Specific Code

> ⚠️ **Note**: This codebase contains LocalStack-specific configurations that should be removed or modified for production deployment.

The application includes various LocalStack-specific workarounds to enable local development. These should be properly addressed before deploying to a production AWS environment.

### Authentication Bypasses

In the Lambda handlers, authentication is bypassed for LocalStack:

```typescript
// In all Lambda handlers (e.g., createsurvey.ts)
// Check if running in LocalStack
const isLocal = process.env.IS_LOCAL === 'true';

// Get the authenticated user ID
let userId: string;

if (isLocal) {
  // In LocalStack, use the x-user-id header
  userId = event.headers['x-user-id'] || 'localstack-test-user-id';
  console.log('Using mock user ID for LocalStack:', userId);
} else {
  // In real AWS, get user ID from Cognito
  userId = event.requestContext.authorizer?.claims?.['sub'];
}
```

### Custom Endpoint Configuration

Database models use special configuration for LocalStack:

```typescript
// In models/survey.ts and models/response.ts
// Configure DynamoDB instance
if (isLocal) {
  // For LocalStack, use the local endpoint
  const ddb = new dynamoose.aws.ddb.DynamoDB({
    endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  });
  
  dynamoose.aws.ddb.set(ddb);
}
```

### API Infrastructure

The API infrastructure has conditional logic for LocalStack:

```typescript
// In lib/constructs/api-constructs.ts
// Add environment variables for Lambda functions
if (isLocalStack) {
  lambdaFunction.addEnvironment('IS_LOCAL', 'true');
  lambdaFunction.addEnvironment(
    'AWS_ENDPOINT_URL',
    'http://localhost:4566'
  );
}

// Different auth mechanism for local vs. production
if (isLocalStack) {
  // Use API Key for LocalStack
  const apiKey = api.addApiKey('DevApiKey', {
    apiKeyName: 'test-api-key-local',
    value: 'test-api-key-local-xyz-753',
  });
  
  // ...
} else {
  // Use Cognito for production
  // ...
}
```

### Production Preparation

Before deploying to production:

1. Remove all `isLocal` conditional checks
2. Implement proper Cognito authentication
3. Remove hardcoded credentials and test API keys
4. Remove custom endpoint URLs
5. Review all Lambda environment variables

## Deployment

To deploy to AWS:

```bash
npx cdk deploy
```

### Environment Variables

The following environment variables are used by the Lambda functions:

| Variable | Description |
|----------|-------------|
| `SURVEYS_TABLE` | Name of the DynamoDB table for surveys |
| `RESPONSES_TABLE` | Name of the DynamoDB table for responses |
| `IS_LOCAL` | Set to 'true' for LocalStack development |
| `AWS_ENDPOINT_URL` | Custom endpoint URL for LocalStack |
| `AWS_REGION` | AWS region to use |

## Lambda Functions

The application uses AWS Lambda for serverless API handlers:

| Function | Description | Source |
|----------|-------------|--------|
| `createSurvey` | Create and update surveys | [createsurvey.ts](/lambda/handlers/createsurvey.ts) |
| `getSurveys` | List all surveys and get a specific survey | [getsurveys.ts](/lambda/handlers/getsurveys.ts) |
| `submitResponse` | Submit a response to a survey | [submitresponse.ts](/lambda/handlers/submitresponse.ts) |
| `getSurveyResults` | Retrieve and analyze survey results | [getsurveyresults.ts](/lambda/handlers/getsurveyresults.ts) |

Each Lambda function:
- Uses environment variables for configuration
- Validates input data
- Implements proper error handling
- Checks user permissions where required
- Returns standardized API responses

## Tests

### Unit Tests

The application includes comprehensive Jest unit tests for all Lambda handlers:

```bash
# Run all unit tests
npm run test:unit

# Run tests for a specific handler
npx jest lambda/handlers/__tests__/createsurvey.test.ts
```

Unit tests cover:
- Success scenarios
- Input validation
- Error handling
- Permission checks
- Edge cases

### Integration Tests

Integration tests verify the complete API flow using LocalStack:

```bash
# Run all integration tests
npm run test:integration:full
```

The integration tests are designed to test the entire application flow from end to end:

```typescript
// test/integration/surveys-api.test.ts
test('Full survey API flow', async () => {
  // 1. Create a survey
  const surveyToCreate = apiClient.generateTestSurvey();
  const createdSurvey = await apiClient.createSurvey(surveyToCreate);
  
  // 2. Get the survey by ID
  const retrievedSurvey = await apiClient.getSurvey(createdSurveyId);
  
  // 3. Update the survey
  const updatedSurvey = await apiClient.updateSurvey(createdSurveyId, {
    title: updatedTitle,
    isPublic: true
  });
  
  // 4. List all surveys
  const surveys = await apiClient.listSurveys();
  
  // 5. Submit a response to the survey
  const submittedResponse = await apiClient.submitResponse(
    createdSurveyId, 
    answers,
    { source: 'integration-test' }
  );
  
  // 6. Get survey results
  const results = await apiClient.getSurveyResults(createdSurveyId);
});
```

> ⚠️ **Note**: Integration tests also rely on LocalStack-specific configurations and may need to be adapted for testing against a real AWS environment.

The tests exercise:
- Creating, reading, and updating surveys
- Submitting responses
- Retrieving survey results
- Permission controls and access restrictions
- Error handling and validation
- Multi-user scenarios

The integration test infrastructure includes utilities for setting up the test environment and managing LocalStack:

```typescript
// test/integration/utils.ts
export async function setupTestEnvironment(): Promise<string> {
  await ensureLocalStackRunning();
  await deployCdkAppToLocalStack();
  return await getApiEndpoint();
}
```

## Project Structure

```
survey-app/
├── bin/                   # CDK app entry point
├── lib/                   # CDK constructs and stack definition
│   ├── constructs/        # Reusable CDK components
│   └── survey-app-stack.ts # Main stack definition
├── lambda/                # Lambda function code
│   ├── handlers/          # API handlers
│   │   ├── __tests__/     # Unit tests for handlers
│   │   ├── createsurvey.ts
│   │   ├── getsurveys.ts
│   │   ├── submitresponse.ts
│   │   └── getsurveyresults.ts
│   ├── layers/            # Lambda layers
│   │   └── common/        # Shared utility functions
│   └── models/            # Data models with Dynamoose
│       ├── index.ts       # Model exports
│       ├── survey.ts      # Survey model
│       └── response.ts    # Response model
├── scripts/               # Development and deployment scripts
└── test/                  # Tests
    ├── integration/       # Integration tests
    └── survey-app.test.ts # CDK stack tests
```