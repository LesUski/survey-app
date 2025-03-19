import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { getSurveyById, listSurveys } from '../../models';
import { handler } from '../getsurveys';

// Mock the models
jest.mock('../../models', () => ({
  getSurveyById: jest.fn(),
  listSurveys: jest.fn(),
}));

describe('getsurveys Lambda function', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      IS_LOCAL: 'true',
      SURVEYS_TABLE: 'test-surveys-table',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Mock event
  const createMockEvent = (pathParameters?: any, headers = {}): APIGatewayProxyEvent => {
    return {
      body: null,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-id',
        ...headers,
      },
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/surveys',
      pathParameters: pathParameters || null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        authorizer: null,
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '127.0.0.1',
          user: null,
          userAgent: 'Jest Test',
          userArn: null,
        },
        path: '/surveys',
        stage: 'test',
        requestId: 'request-id',
        requestTimeEpoch: 1618884475548,
        resourceId: 'resource-id',
        resourcePath: '/surveys',
      },
      resource: '/surveys',
    } as unknown as APIGatewayProxyEvent;
  };

  // Mock Context
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'getsurveys',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:getsurveys',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: 'logGroupName',
    logStreamName: 'logStreamName',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  test('should get all accessible surveys', async () => {
    // Arrange
    const allSurveys = [
      {
        surveyId: 'survey-1',
        title: 'User Survey 1',
        description: 'A survey owned by the test user',
        questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
        ownerId: 'test-user-id',
        createdAt: '2025-03-12T00:00:00.000Z',
        updatedAt: '2025-03-12T00:00:00.000Z',
        isActive: true,
        isPublic: false,
        responseCount: 0,
      },
      {
        surveyId: 'survey-2',
        title: 'Public Survey',
        description: 'A public survey owned by another user',
        questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
        ownerId: 'other-user-id',
        createdAt: '2025-03-13T00:00:00.000Z',
        updatedAt: '2025-03-13T00:00:00.000Z',
        isActive: true,
        isPublic: true,
        responseCount: 5,
      },
      {
        surveyId: 'survey-3',
        title: 'Private Survey',
        description: 'A private survey owned by another user',
        questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
        ownerId: 'other-user-id',
        createdAt: '2025-03-14T00:00:00.000Z',
        updatedAt: '2025-03-14T00:00:00.000Z',
        isActive: true,
        isPublic: false,
        responseCount: 2,
      },
    ];

    // Mock listSurveys to return all surveys
    (listSurveys as jest.Mock).mockResolvedValue(allSurveys);

    // Act
    const result = await handler(createMockEvent(), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);

    // Filtered surveys should include user's own surveys and public surveys
    const expectedSurveys = [allSurveys[0], allSurveys[1]]; // survey-1 and survey-2
    expect(JSON.parse(result.body)).toEqual(expectedSurveys);
    expect(listSurveys).toHaveBeenCalled();
  });

  test('should get a specific survey by ID that the user owns', async () => {
    // Arrange
    const surveyId = 'survey-1';
    const survey = {
      surveyId,
      title: 'User Survey 1',
      description: 'A survey owned by the test user',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'test-user-id',
      createdAt: '2025-03-12T00:00:00.000Z',
      updatedAt: '2025-03-12T00:00:00.000Z',
      isActive: true,
      isPublic: false,
      responseCount: 0,
    };

    // Mock getSurveyById
    (getSurveyById as jest.Mock).mockResolvedValue(survey);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(survey);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
  });

  test('should get a specific public survey by ID', async () => {
    // Arrange
    const surveyId = 'public-survey-id';
    const survey = {
      surveyId,
      title: 'Public Survey',
      description: 'A public survey owned by another user',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'other-user-id',
      createdAt: '2025-03-13T00:00:00.000Z',
      updatedAt: '2025-03-13T00:00:00.000Z',
      isActive: true,
      isPublic: true,
      responseCount: 5,
    };

    // Mock getSurveyById
    (getSurveyById as jest.Mock).mockResolvedValue(survey);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(survey);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
  });

  test('should return 404 when survey not found', async () => {
    // Arrange
    const surveyId = 'non-existent-id';

    // Mock getSurveyById to return null
    (getSurveyById as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Survey not found',
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
  });

  test('should return 403 when requesting a private survey owned by another user', async () => {
    // Arrange
    const surveyId = 'private-survey-id';
    const survey = {
      surveyId,
      title: 'Private Survey',
      description: 'A private survey owned by another user',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'other-user-id',
      createdAt: '2025-03-14T00:00:00.000Z',
      updatedAt: '2025-03-14T00:00:00.000Z',
      isActive: true,
      isPublic: false,
      responseCount: 2,
    };

    // Mock getSurveyById
    (getSurveyById as jest.Mock).mockResolvedValue(survey);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Access denied',
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
  });

  test('should handle internal errors', async () => {
    // Arrange
    const error = new Error('Database connection failed');
    (listSurveys as jest.Mock).mockRejectedValue(error);

    // Act
    const result = await handler(createMockEvent(), mockContext);

    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal server error',
      error: 'Database connection failed',
    });
  });
});
