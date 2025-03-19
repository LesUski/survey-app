import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { SurveyModel, getSurveyById, createSurvey, updateSurvey } from '../../models';
import { handler } from '../createsurvey';

// Mock the models
jest.mock('../../models', () => ({
  getSurveyById: jest.fn(),
  createSurvey: jest.fn(),
  updateSurvey: jest.fn(),
  SurveyModel: {
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

describe('createsurvey Lambda function', () => {
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
  const createMockEvent = (body: any, pathParameters?: any, headers = {}): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-id',
        ...headers,
      },
      multiValueHeaders: {},
      httpMethod: 'POST',
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
        httpMethod: 'POST',
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
    functionName: 'createsurvey',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:createsurvey',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: 'logGroupName',
    logStreamName: 'logStreamName',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  test('should create a new survey successfully', async () => {
    // Arrange
    const surveyData = {
      title: 'Test Survey',
      description: 'A test survey',
      questions: [
        {
          id: 'q1',
          text: 'What do you think of this test?',
          type: 'text',
          required: true,
        },
      ],
      isActive: true,
      isPublic: false,
    };

    const createdSurvey = {
      surveyId: 'test-survey-id',
      ...surveyData,
      ownerId: 'test-user-id',
      createdAt: '2025-03-14T00:00:00.000Z',
      updatedAt: '2025-03-14T00:00:00.000Z',
      responseCount: 0,
    };

    // Mock the createSurvey function to return our test data
    (createSurvey as jest.Mock).mockResolvedValue(createdSurvey);

    // Act
    const result = await handler(createMockEvent(surveyData), mockContext);

    // Assert
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual(createdSurvey);
    expect(createSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        title: surveyData.title,
        description: surveyData.description,
        questions: surveyData.questions,
        ownerId: 'test-user-id',
      })
    );
  });

  test('should update an existing survey successfully', async () => {
    // Arrange
    const surveyId = 'existing-survey-id';

    const existingSurvey = {
      surveyId,
      title: 'Original Title',
      description: 'Original description',
      questions: [{ id: 'q1', text: 'Original question', type: 'text', required: true }],
      ownerId: 'test-user-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: false,
      responseCount: 0,
    };

    const updateData = {
      title: 'Updated Title',
      description: 'Updated description',
      questions: [
        { id: 'q1', text: 'Updated question', type: 'text', required: true },
        { id: 'q2', text: 'New question', type: 'multiple_choice', required: false },
      ],
      isActive: false,
    };

    const updatedSurvey = {
      ...existingSurvey,
      ...updateData,
      updatedAt: '2025-03-14T00:00:00.000Z',
    };

    // Mock the getSurveyById and updateSurvey functions
    (getSurveyById as jest.Mock).mockResolvedValue(existingSurvey);
    (updateSurvey as jest.Mock).mockResolvedValue(updatedSurvey);

    // Act
    const result = await handler(createMockEvent(updateData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(updatedSurvey);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(updateSurvey).toHaveBeenCalledWith(
      surveyId,
      expect.objectContaining({
        title: updateData.title,
        description: updateData.description,
        questions: updateData.questions,
      })
    );
  });

  test('should return 400 when required fields are missing', async () => {
    // Arrange
    const invalidData = {
      // Missing title
      description: 'A test survey without a title',
      // Missing questions array
    };

    // Act
    const result = await handler(createMockEvent(invalidData), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Missing required fields',
    });
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test('should return 400 when questions array is empty', async () => {
    // Arrange
    const invalidData = {
      title: 'Test Survey',
      description: 'A test survey with empty questions',
      questions: [], // Empty questions array
    };

    // Act
    const result = await handler(createMockEvent(invalidData), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Missing required fields',
    });
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test('should return 404 when updating a non-existent survey', async () => {
    // Arrange
    const surveyId = 'non-existent-survey-id';

    const updateData = {
      title: 'Updated Title',
      description: 'Updated description',
      questions: [{ id: 'q1', text: 'Question', type: 'text', required: true }],
    };

    // Mock getSurveyById to return null (survey not found)
    (getSurveyById as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await handler(createMockEvent(updateData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Survey not found',
    });
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 403 when updating a survey owned by another user', async () => {
    // Arrange
    const surveyId = 'other-user-survey-id';

    const existingSurvey = {
      surveyId,
      title: 'Original Title',
      description: 'Original description',
      questions: [{ id: 'q1', text: 'Original question', type: 'text', required: true }],
      ownerId: 'other-user-id', // Different from test-user-id
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: false,
    };

    const updateData = {
      title: 'Updated Title',
      description: 'Updated description',
      questions: [{ id: 'q1', text: 'Updated question', type: 'text', required: true }],
    };

    // Mock getSurveyById to return a survey owned by another user
    (getSurveyById as jest.Mock).mockResolvedValue(existingSurvey);

    // Act
    const result = await handler(createMockEvent(updateData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'You do not have permission to update this survey',
    });
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should handle internal errors', async () => {
    // Arrange
    const surveyData = {
      title: 'Test Survey',
      description: 'A test survey',
      questions: [
        {
          id: 'q1',
          text: 'What do you think of this test?',
          type: 'text',
          required: true,
        },
      ],
    };

    // Mock createSurvey to throw an error
    const error = new Error('Database connection failed');
    (createSurvey as jest.Mock).mockRejectedValue(error);

    // Act
    const result = await handler(createMockEvent(surveyData), mockContext);

    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal server error',
      error: 'Database connection failed',
    });
  });
});
