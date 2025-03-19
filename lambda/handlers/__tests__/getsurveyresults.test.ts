import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { getSurveyById, getResponsesBySurveyId } from '../../models';
import { handler } from '../getsurveyresults';

// Mock the models
jest.mock('../../models', () => ({
  getSurveyById: jest.fn(),
  getResponsesBySurveyId: jest.fn(),
}));

describe('getsurveyresults Lambda function', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      IS_LOCAL: 'true',
      SURVEYS_TABLE: 'test-surveys-table',
      RESPONSES_TABLE: 'test-responses-table',
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
      path: '/surveys/{surveyId}/results',
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
        path: '/surveys/{surveyId}/results',
        stage: 'test',
        requestId: 'request-id',
        requestTimeEpoch: 1618884475548,
        resourceId: 'resource-id',
        resourcePath: '/surveys/{surveyId}/results',
      },
      resource: '/surveys/{surveyId}/results',
    } as unknown as APIGatewayProxyEvent;
  };

  // Mock Context
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'getsurveyresults',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:getsurveyresults',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: 'logGroupName',
    logStreamName: 'logStreamName',
    getRemainingTimeInMillis: () => 1000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  test('should get survey results successfully for owner', async () => {
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
      ownerId: 'test-user-id', // Owner is the test user
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: false,
      responseCount: 2,
    };

    const responses = [
      {
        responseId: 'response-1',
        surveyId,
        answers: [
          { questionId: 'q1', value: 'Answer 1 for response 1' },
          { questionId: 'q2', value: 'c1' },
        ],
        respondentId: 'respondent-1',
        submittedAt: '2025-03-12T00:00:00.000Z',
      },
      {
        responseId: 'response-2',
        surveyId,
        answers: [
          { questionId: 'q1', value: 'Answer 1 for response 2' },
          { questionId: 'q2', value: 'c2' },
        ],
        respondentId: 'respondent-2',
        submittedAt: '2025-03-13T00:00:00.000Z',
      },
    ];

    // Expected result format
    const expectedResult = {
      surveyId,
      title: 'Test Survey',
      responseCount: 2,
      questions: [
        {
          id: 'q1',
          text: 'Question 1',
          type: 'text',
          responses: ['Answer 1 for response 1', 'Answer 1 for response 2'],
        },
        {
          id: 'q2',
          text: 'Question 2',
          type: 'multiple_choice',
          responses: ['c1', 'c2'],
        },
      ],
    };

    // Mock functions
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    (getResponsesBySurveyId as jest.Mock).mockResolvedValue(responses);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(expectedResult);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(getResponsesBySurveyId).toHaveBeenCalledWith(surveyId);
  });

  test('should get survey results successfully for public survey', async () => {
    // Arrange
    const surveyId = 'public-survey-id';
    const survey = {
      surveyId,
      title: 'Public Survey',
      description: 'A public survey',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'other-user-id', // Owned by another user
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: true, // But it's public
      responseCount: 1,
    };

    const responses = [
      {
        responseId: 'response-1',
        surveyId,
        answers: [{ questionId: 'q1', value: 'Public survey answer' }],
        submittedAt: '2025-03-12T00:00:00.000Z',
      },
    ];

    // Expected result format
    const expectedResult = {
      surveyId,
      title: 'Public Survey',
      responseCount: 1,
      questions: [
        {
          id: 'q1',
          text: 'Question 1',
          type: 'text',
          responses: ['Public survey answer'],
        },
      ],
    };

    // Mock functions
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    (getResponsesBySurveyId as jest.Mock).mockResolvedValue(responses);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(expectedResult);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(getResponsesBySurveyId).toHaveBeenCalledWith(surveyId);
  });

  test('should return 400 when survey ID is missing', async () => {
    // Act
    const result = await handler(
      createMockEvent(null), // No surveyId
      mockContext
    );

    // Assert
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Missing survey ID',
    });
    expect(getSurveyById).not.toHaveBeenCalled();
    expect(getResponsesBySurveyId).not.toHaveBeenCalled();
  });

  test('should return 404 when survey is not found', async () => {
    // Arrange
    const surveyId = 'non-existent-survey-id';

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
    expect(getResponsesBySurveyId).not.toHaveBeenCalled();
  });

  test('should return 403 when user does not have permission to view results', async () => {
    // Arrange
    const surveyId = 'private-survey-id';
    const survey = {
      surveyId,
      title: 'Private Survey',
      description: 'A private survey owned by another user',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'other-user-id', // Different from test-user-id
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: false, // Not public
      responseCount: 5,
    };

    // Mock getSurveyById
    (getSurveyById as jest.Mock).mockResolvedValue(survey);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      message: 'You do not have permission to view these results',
    });
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(getResponsesBySurveyId).not.toHaveBeenCalled();
  });

  test('should handle empty responses array', async () => {
    // Arrange
    const surveyId = 'no-responses-survey-id';
    const survey = {
      surveyId,
      title: 'Survey With No Responses',
      description: 'A survey with no responses yet',
      questions: [{ id: 'q1', text: 'Question 1', type: 'text', required: true }],
      ownerId: 'test-user-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: false,
      responseCount: 0,
    };

    // Mock functions to return empty responses
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    (getResponsesBySurveyId as jest.Mock).mockResolvedValue([]);

    // Expected result format
    const expectedResult = {
      surveyId,
      title: 'Survey With No Responses',
      responseCount: 0,
      questions: [
        {
          id: 'q1',
          text: 'Question 1',
          type: 'text',
          responses: [],
        },
      ],
    };

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(expectedResult);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(getResponsesBySurveyId).toHaveBeenCalledWith(surveyId);
  });

  test('should handle answers with null values', async () => {
    // Arrange
    const surveyId = 'survey-with-nulls';
    const survey = {
      surveyId,
      title: 'Survey With Some Null Values',
      description: 'A survey with some null answer values',
      questions: [
        { id: 'q1', text: 'Question 1', type: 'text', required: false },
        { id: 'q2', text: 'Question 2', type: 'text', required: true },
      ],
      ownerId: 'test-user-id',
      createdAt: '2025-03-10T00:00:00.000Z',
      updatedAt: '2025-03-10T00:00:00.000Z',
      isActive: true,
      isPublic: false,
      responseCount: 2,
    };

    const responses = [
      {
        responseId: 'response-1',
        surveyId,
        answers: [
          // q1 is missing/skipped
          { questionId: 'q2', value: 'Answer to q2' },
        ],
        submittedAt: '2025-03-12T00:00:00.000Z',
      },
      {
        responseId: 'response-2',
        surveyId,
        answers: [
          { questionId: 'q1', value: 'Answer to q1' },
          { questionId: 'q2', value: 'Another answer to q2' },
        ],
        submittedAt: '2025-03-13T00:00:00.000Z',
      },
    ];

    // Mock functions
    (getSurveyById as jest.Mock).mockResolvedValue(survey);
    (getResponsesBySurveyId as jest.Mock).mockResolvedValue(responses);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(200);
    const parsedBody = JSON.parse(result.body);
    // q1 should only have one response since one respondent skipped it
    expect(parsedBody.questions[0].responses).toHaveLength(1);
    expect(parsedBody.questions[0].responses).toEqual(['Answer to q1']);
    // q2 should have two responses
    expect(parsedBody.questions[1].responses).toHaveLength(2);
    expect(getSurveyById).toHaveBeenCalledWith(surveyId);
    expect(getResponsesBySurveyId).toHaveBeenCalledWith(surveyId);
  });

  test('should handle internal errors', async () => {
    // Arrange
    const surveyId = 'error-survey-id';
    const error = new Error('Database connection failed');

    // Mock getSurveyById to throw an error
    (getSurveyById as jest.Mock).mockRejectedValue(error);

    // Act
    const result = await handler(createMockEvent({ surveyId }), mockContext);

    // Assert
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal server error',
      error: 'Database connection failed',
    });
  });
});
