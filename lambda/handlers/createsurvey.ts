import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

import { logApiGatewayEvent } from '../commons/helpers/logging';
import { assertIsError } from '../commons/helpers/utils';
import { logger } from '../commons/powertools/logger';
import { SurveyItem, createSurvey, updateSurvey, getSurveyById, Question } from '../models';

// Check if running in LocalStack
const isLocal = process.env.IS_LOCAL === 'true';

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  logApiGatewayEvent(logger, event);

  try {
    logger.debug('Environment variables', {
      SURVEYS_TABLE: process.env.SURVEYS_TABLE,
      IS_LOCAL: process.env.IS_LOCAL,
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
    });

    // Get the authenticated user ID
    let userId: string;

    if (isLocal) {
      // In LocalStack, use the x-user-id header
      userId = event.headers['x-user-id'] || 'localstack-test-user-id';
      logger.debug('Using mock user ID for LocalStack', { userId });
    } else {
      // In real AWS, get user ID from Cognito
      userId = event.requestContext.authorizer?.claims?.['sub'];

      if (!userId) {
        logger.warn('Unauthorized request - no user ID found');
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            message: 'Unauthorized',
          }),
        };
      }
    }

    logger.debug('User ID set in logger context', { userId });

    // Parse the request body
    const requestBody = JSON.parse(event.body || '{}');
    const { title, description, questions } = requestBody;

    // Validate request
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      logger.warn('Validation failed', {
        title,
        questionsProvided: !!questions,
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Missing required fields',
        }),
      };
    }

    // Check if we're updating an existing survey
    const surveyId = event.pathParameters?.surveyId || uuidv4();
    const isUpdate = !!event.pathParameters?.surveyId;

    logger.debug('Survey ID set in logger context', { surveyId });
    logger.info(`${isUpdate ? 'Update' : 'Create'} survey operation initiated`);

    // If updating, verify ownership
    if (isUpdate) {
      logger.debug('Fetching existing survey');
      const existingSurvey = await getSurveyById(surveyId);

      if (!existingSurvey) {
        logger.warn('Survey not found', { surveyId });
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

      logger.debug('Survey ownership check', {
        surveyOwnerId: existingSurvey.ownerId,
        requestUserId: userId,
      });

      if (existingSurvey.ownerId !== userId) {
        logger.warn('Permission denied', {
          surveyOwnerId: existingSurvey.ownerId,
          requestUserId: userId,
        });

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            message: 'You do not have permission to update this survey',
          }),
        };
      }
    }

    // Create/update the survey
    const timestamp = new Date().toISOString();

    const surveyData: Partial<SurveyItem> = {
      surveyId,
      title,
      description: description || '',
      questions: questions as Question[],
      ownerId: userId,
      updatedAt: timestamp,
      isActive: requestBody.isActive !== undefined ? requestBody.isActive : true,
      isPublic: requestBody.isPublic !== undefined ? requestBody.isPublic : false,
      settings: requestBody.settings || {},
    };

    if (!isUpdate) {
      surveyData.createdAt = timestamp;
      surveyData.responseCount = 0;
    }

    logger.debug('Survey data prepared', { surveyData });

    let result;
    try {
      if (isUpdate) {
        logger.info('Updating survey', { surveyId });
        logger.debug('Update survey data', { surveyData });
        result = await updateSurvey(surveyId, surveyData);
      } else {
        logger.info('Creating new survey');
        logger.debug('Create survey data', { surveyData });
        result = await createSurvey(surveyData);
      }
    } catch (error) {
      assertIsError(error);
      logger.error(`Failed to ${isUpdate ? 'update' : 'create'} survey`, error);
      throw error; // Re-throw to be caught by outer try/catch
    }

    if (!result) {
      logger.error(`${isUpdate ? 'Update' : 'Create'} operation returned null result`);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: `Failed to ${isUpdate ? 'update' : 'create'} survey`,
        }),
      };
    }

    logger.info(`Survey ${isUpdate ? 'updated' : 'created'} successfully`, {
      surveyId: result.surveyId,
      title: result.title,
    });

    return {
      statusCode: isUpdate ? 200 : 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    assertIsError(error);
    logger.error('Unhandled exception in handler', error);

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
