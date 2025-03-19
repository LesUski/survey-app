import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { logApiGatewayEvent } from '../commons/helpers/logging';
import { assertIsError } from '../commons/helpers/utils';
import { logger } from '../commons/powertools/logger';
import { getSurveyById, listSurveys } from '../models';

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
      IS_LOCAL: process.env.IS_LOCAL,
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
    });

    // Get the authenticated user ID
    let userId: string;

    if (isLocal) {
      // In LocalStack, use the x-user-id header
      userId = event.headers['x-user-id'] || 'localstack-test-user-id';
      logger.debug('Using mock user ID for LocalStack:', userId);
    } else {
      // In real AWS, get user ID from Cognito
      userId = event.requestContext.authorizer?.claims?.['sub'];
    }

    // Check if we're getting a specific survey
    const surveyId = event.pathParameters?.surveyId;

    if (surveyId) {
      // Get a specific survey
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

      // Check if the survey is public or owned by the user
      if (!survey.isPublic && survey.ownerId !== userId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            message: 'Access denied',
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(survey),
      };
    } else {
      // Get all surveys (filtered by ownership or public status)
      // Two conditions:
      // 1. Survey is public (isPublic = true)
      // 2. Survey is owned by the user (ownerId = userId)
      const surveys = await listSurveys();

      // Filter surveys to include only public ones or those owned by the user
      const filteredSurveys = surveys.filter(
        survey => survey.isPublic || survey.ownerId === userId
      );

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(filteredSurveys),
      };
    }
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
