import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { logApiGatewayEvent } from '../commons/helpers/logging';
import { assertIsError } from '../commons/helpers/utils';
import { logger } from '../commons/powertools/logger';
import { getSurveyById, getResponsesBySurveyId, Question, ResponseItem } from '../models';

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
      RESPONSES_TABLE: process.env.RESPONSES_TABLE,
      IS_LOCAL: process.env.IS_LOCAL,
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
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

    logger.debug('User ID set', { userId });

    // Get the survey ID from the path parameters
    const surveyId = event.pathParameters?.surveyId;
    if (!surveyId) {
      logger.warn('Missing survey ID');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Missing survey ID',
        }),
      };
    }

    logger.debug('Survey ID set', { surveyId });

    // Get the survey to check ownership
    logger.debug('Fetching survey');
    const survey = await getSurveyById(surveyId);

    if (!survey) {
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

    // Check if the user is allowed to see the results
    logger.debug('Survey ownership check', {
      surveyOwnerId: survey.ownerId,
      requestUserId: userId,
      isPublic: survey.isPublic,
    });

    if (!survey.isPublic && survey.ownerId !== userId) {
      logger.warn('Permission denied', {
        surveyOwnerId: survey.ownerId,
        requestUserId: userId,
      });
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'You do not have permission to view these results',
        }),
      };
    }

    // Get responses for the survey
    logger.debug('Fetching survey responses');
    const responses = await getResponsesBySurveyId(surveyId);
    logger.info('Responses retrieved', { responseCount: responses.length });

    // Prepare the results
    const questions: Question[] = survey.questions || [];

    // Compile summarized results
    logger.debug('Compiling survey results');
    const results = {
      surveyId,
      title: survey.title,
      responseCount: responses.length,
      questions: questions.map((q: Question) => {
        const questionResponses = responses
          .map((r: ResponseItem) => {
            const answer = r.answers?.find(a => a.questionId === q.id);
            return answer ? answer.value : null;
          })
          .filter(Boolean);

        return {
          id: q.id,
          text: q.text,
          type: q.type,
          responses: questionResponses,
        };
      }),
    };

    logger.info('Survey results compiled successfully', {
      surveyId,
      title: survey.title,
      responseCount: responses.length,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(results),
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
