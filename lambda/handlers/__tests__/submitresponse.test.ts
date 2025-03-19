import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { getSurveyById, updateSurvey, createResponse } from '../../models';
import { handler } from '../submitresponse';

// Mock the models
jest.mock('../../models', () => ({
  getSurveyById: jest.fn(),
  updateSurvey: jest.fn(),
  createResponse: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-response-id'),
}));

describe('submitresponse Lambda function', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    // Mock Date.now to return a fixed timestamp
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-03-14T12:00:00.000Z');
    process.env = {
      ...originalEnv,
      IS_LOCAL: 'true',
      SURVEYS_TABLE: 'test-surveys-table',
      RESPONSES_TABLE: 'test-responses-table',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // Mock event
  const createMockEvent = (body: any, pathParameters?: any, headers = {}): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-id',
        'User-Agent': 'Jest Test Agent',
        ...headers,
      },
      multiValueHeaders: {},
      httpMethod: 'POST',
      isBase64Encoded: false,
      path: '/surveys/{surveyId}/responses',
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
        path: '/surveys/{surveyId}/responses',
        stage: 'test',
        requestId: 'request-id',
        requestTimeEpoch: 1618884475548,
        resourceId: 'resource-id',
        resourcePath: '/surveys/{surveyId}/responses',
      },
      resource: '/surveys/{surveyId}/responses',
    } as unknown as APIGatewayProxyEvent;
  };

  // Mock Context
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'submitresponse',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:submitresponse',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: 'logGroupName',
    logStreamName: 'logStreamName',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  test('should submit a response to an active survey successfully', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const survey = {
      surveyId,
      title: 'Test Survey',
      description: 'A test survey',
      questions: [
        {
          id: 'q1',
          text: 'Question 1',
          type: 'text',
          required: true,
        },
        {
          id: 'q2',
          text: 'Question 2',
          type: 'multiple_choice',
          required: true,
          choices: [
            { id: 'c1', text: 'Choice 1' },
            { id: 'c2', text: 'Choice 2' },
          ],
        },
      ],
      ownerId: 'survey-owner-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: true,
      responseCount: 5,
    };

    const responseData = {
      answers: [
        { questionId: 'q1', value: 'This is my answer to question 1' },
        { questionId: 'q2', value: 'c2' },
      ],
      metadata: {
        source: 'web',
        deviceType: 'desktop',
      },
    };

    const expectedResponse = {
      responseId: 'test-response-id',
      surveyId,
      answers: responseData.answers,
      respondentId: 'test-user-id',
      submittedAt: '2025-03-14T12:00:00.000Z',
      metadata: responseData.metadata,
      ipAddress: '127.0.0.1',
      userAgent: 'Jest Test Agent',
    };

    // Mock the functions
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    (createResponse as jest.Mock).mockResolvedValue(expectedResponse);
    (updateSurvey as jest.Mock).mockResolvedValue({
      ...survey,
      responseCount: 6,
    });

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(201);
    const parsedResponse = JSON.parse(result.body);
    expect(parsedResponse.message).toBe('Survey response submitted successfully');
    expect(parsedResponse).toHaveProperty('responseId');

    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId,
        answers: responseData.answers,
        submittedAt: '2025-03-14T12:00:00.000Z',
        respondentId: 'test-user-id',
      })
    );
    expect(updateSurvey).toHaveBeenCalledWith(surveyId, {
      responseCount: 6,
    });
  });

  test('should submit an anonymous response successfully', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const survey = {
      surveyId,
      title: 'Test Survey',
      description: 'A test survey',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'survey-owner-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: true,
      responseCount: 5,
    };

    const responseData = {
      answers: [{ questionId: 'q1', value: 'Anonymous answer' }],
    };

    const expectedResponse = {
      responseId: 'test-response-id',
      surveyId,
      answers: responseData.answers,
      submittedAt: '2025-03-14T12:00:00.000Z',
      metadata: {},
      ipAddress: '127.0.0.1',
      userAgent: 'Jest Test Agent',
    };

    // Mock the functions
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    (createResponse as jest.Mock).mockResolvedValue(expectedResponse);
    (updateSurvey as jest.Mock).mockResolvedValue({
      ...survey,
      responseCount: 6,
    });

    // Act - No user ID in headers
    const result = await handler(
      createMockEvent(responseData, { surveyId }, { 'x-user-id': undefined }),
      mockContext
    );

    // Assert
    expect(result.statusCode).toBe(201);
    const parsedResponse = JSON.parse(result.body);
    expect(parsedResponse.message).toBe('Survey response submitted successfully');
    expect(parsedResponse).toHaveProperty('responseId');

    expect(createResponse).toHaveBeenCalledWith(
      expect.not.objectContaining({
        respondentId: expect.any(String),
      })
    );
  });

  test('should return 400 when survey ID is missing', async () => {
    // Arrange
    const responseData = {
      answers: [{ questionId: 'q1', value: 'This is my answer' }],
    };

    // Act
    const result = await handler(createMockEvent(responseData, null), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Survey ID is required',
    });
    expect(getSurveyById).not.toHaveBeenCalled();
    expect(createResponse).not.toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 400 when answers are missing', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const responseData = {
      // Missing answers array
      metadata: {
        source: 'web',
      },
    };

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Survey answers are required',
    });
    expect(getSurveyById).not.toHaveBeenCalled();
    expect(createResponse).not.toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 400 when answers array is empty', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const responseData = {
      answers: [], // Empty answers array
    };

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Survey answers are required',
    });
    expect(getSurveyById).not.toHaveBeenCalled();
    expect(createResponse).not.toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 404 when survey is not found', async () => {
    // Arrange
    const surveyId = 'non-existent-survey-id';
    const responseData = {
      answers: [{ questionId: 'q1', value: 'This is my answer' }],
    };

    // Mock getSurveyById to return null
    (getSurveyById as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Survey not found',
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(createResponse).not.toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 400 when survey is not active', async () => {
    // Arrange
    const surveyId = 'inactive-survey-id';
    const survey = {
      surveyId,
      title: 'Inactive Survey',
      description: 'An inactive survey',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'survey-owner-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: false, // Inactive survey
      isPublic: true,
      responseCount: 5,
    };

    const responseData = {
      answers: [{ questionId: 'q1', value: 'This is my answer' }],
    };

    // Mock getSurveyById to return an inactive survey
    (getSurveyById as jest.Mock).mockResolvedValue(survey);

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'This survey is no longer active',
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(createResponse).not.toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 400 when required questions are not answered', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const survey = {
      surveyId,
      title: 'Test Survey',
      description: 'A test survey',
      questions: [
        {
          id: 'q1',
          text: 'Question 1',
          type: 'text',
          required: true, // Required question
        },
        {
          id: 'q2',
          text: 'Question 2',
          type: 'multiple_choice',
          required: true, // Required question
        },
        {
          id: 'q3',
          text: 'Question 3',
          type: 'text',
          required: false, // Optional question
        },
      ],
      ownerId: 'survey-owner-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: true,
      responseCount: 5,
    };

    const responseData = {
      answers: [
        { questionId: 'q1', value: 'Answer to question 1' },
        // Missing answer for q2 (required)
        { questionId: 'q3', value: 'Answer to question 3' },
      ],
    };

    // Mock getSurveyById
    (getSurveyById as jest.Mock).mockResolvedValue(survey);

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Some required questions are not answered',
      missingQuestions: ['q2'],
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(createResponse).not.toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should return 500 when response creation fails', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const survey = {
      surveyId,
      title: 'Test Survey',
      description: 'A test survey',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'survey-owner-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: true,
      responseCount: 5,
    };

    const responseData = {
      answers: [{ questionId: 'q1', value: 'This is my answer' }],
    };

    // Mock getSurveyById to return the survey
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    // Mock createResponse to return null (failure)
    (createResponse as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Failed to save response',
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(createResponse).toHaveBeenCalled();
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test('should handle internal errors', async () => {
    // Arrange
    const surveyId = 'test-survey-id';
    const responseData = {
      answers: [{ questionId: 'q1', value: 'This is my answer' }],
    };

    // Mock getSurveyById to throw an error
    const error = new Error('Database connection failed');
    (getSurveyById as jest.Mock).mockRejectedValue(error);

    // Act
    const result = await handler(createMockEvent(responseData, { surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal server error',
      error: 'Database connection failed',
    });
  });
});
