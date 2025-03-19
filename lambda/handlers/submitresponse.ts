import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

import { logApiGatewayEvent } from '../commons/helpers/logging';
import { assertIsError } from '../commons/helpers/utils';
import { logger } from '../commons/powertools/logger';
import {
  getSurveyById,
  createResponse,
  Question,
  Answer,
  ResponseItem,
  incrementSurveyResponseCount,
} from '../models';

// Check if running in LocalStack
const isLocal = process.env.IS_LOCAL === 'true';

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    logApiGatewayEvent(logger, event);
    logger.debug('Environment:', {
      SURVEYS_TABLE: process.env.SURVEYS_TABLE,
      RESPONSES_TABLE: process.env.RESPONSES_TABLE,
      IS_LOCAL: process.env.IS_LOCAL,
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
    });

    // Get the survey ID from path parameters
    const surveyId = event.pathParameters?.surveyId;

    if (!surveyId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Survey ID is required',
        }),
      };
    }

    // Parse the request body
    const requestBody = JSON.parse(event.body || '{}');
    const { answers, metadata } = requestBody;

    // Validate request
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Survey answers are required',
        }),
      };
    }

    // Get the authenticated user ID if available
    let userId: string | undefined;

    if (isLocal) {
      // In LocalStack, use the x-user-id header if present
      userId = event.headers['x-user-id'];
    } else {
      // In real AWS, get user ID from Cognito if authenticated
      userId = event.requestContext.authorizer?.claims?.['sub'];
    }

    // Check if the survey exists and is active
    const survey = await getSurveyById(surveyId);

    if (!survey) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Survey not found',
        }),
      };
    }

    // Check if the survey is active
    if (!survey.isActive) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'This survey is no longer active',
        }),
      };
    }

    // Verify that all required questions have been answered
    const questions: Question[] = survey.questions || [];
    const requiredQuestionIds = questions.filter(q => q.required).map(q => q.id);

    const answeredQuestionIds = answers.map((a: Answer) => a.questionId);

    const missingAnswers = requiredQuestionIds.filter(id => !answeredQuestionIds.includes(id));

    if (missingAnswers.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Some required questions are not answered',
          missingQuestions: missingAnswers,
        }),
      };
    }

    // Generate a unique ID for the response
    const responseId = uuidv4();
    const timestamp = new Date().toISOString();

    // Create the response object
    const responseData: Partial<ResponseItem> = {
      responseId, // Add the responseId
      surveyId,
      answers: answers as Answer[],
      submittedAt: timestamp,
      metadata: metadata || {},
      ipAddress: event.requestContext.identity?.sourceIp,
      userAgent: event.headers['User-Agent'],
    };

    // Add respondent ID if authenticated
    if (userId) {
      responseData.respondentId = userId;
    }

    // Save the response
    const response = await createResponse(responseData);

    if (!response) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Failed to save response',
        }),
      };
    }

    // Get the response ID from the saved response
    const savedResponseId = response.responseId;

    // Update survey response count
    if (response) {
      try {
        // Use atomic counter update for responseCount to avoid race conditions
        const updatedSurvey = await incrementSurveyResponseCount(surveyId);

        if (!updatedSurvey) {
          logger.warn('Failed to update survey response count', { surveyId });
          // Continue execution - don't fail the request just because of counter update
        }
      } catch (error) {
        assertIsError(error);
        logger.error('Error updating survey response count:', error);
        // Continue execution - don't fail the request just because of counter update
      }
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Survey response submitted successfully',
        responseId: savedResponseId,
      }),
    };
  } catch (error) {
    assertIsError(error);
    logger.error('Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
