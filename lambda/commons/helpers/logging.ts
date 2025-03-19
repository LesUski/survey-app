import { Logger } from '@aws-lambda-powertools/logger';

import { APIGatewayProxyEvent } from 'aws-lambda';

interface EventLogOptions {
  includeBody?: boolean;
  includeQueryParams?: boolean;
  includePath?: boolean;
  includeHeaders?: boolean;
  sensitiveHeaders?: string[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Format and log API Gateway event with configurable options
 */
export function logApiGatewayEvent(
  logger: Logger,
  event: APIGatewayProxyEvent,
  options: EventLogOptions = {}
): void {
  const {
    includeBody = true,
    includeQueryParams = true,
    includePath = true,
    includeHeaders = true,
    sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'],
    logLevel = process.env.LOG_LEVEL || 'info',
  } = options;

  // Parse body if it exists and includeBody is true
  let parsedBody = undefined;
  if (includeBody && event.body) {
    try {
      parsedBody = JSON.parse(event.body);
    } catch (error) {
      logger.error('Error parsing event body', { error });
      // If body isn't valid JSON, log it as-is
      parsedBody = event.body;
    }
  }

  // Filter headers to exclude sensitive information
  const filteredHeaders = includeHeaders
    ? Object.entries(event.headers || {}).reduce(
        (acc, [key, value]) => {
          const lowerKey = key.toLowerCase();
          if (sensitiveHeaders.includes(lowerKey)) {
            acc[key] = '[REDACTED]';
          } else {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>
      )
    : undefined;

  // Build the event summary
  const eventSummary: Record<string, unknown> = {
    httpMethod: event.httpMethod,
  };

  if (includePath) {
    eventSummary.path = event.path;
    eventSummary.pathParameters = event.pathParameters;
    eventSummary.resource = event.resource;
  }

  if (includeQueryParams) {
    eventSummary.queryStringParameters = event.queryStringParameters;
  }

  if (includeHeaders) {
    eventSummary.headers = filteredHeaders;
  }

  if (includeBody) {
    eventSummary.body = parsedBody;
  }

  // Log with the specified level
  switch (logLevel) {
    case 'debug':
      logger.debug('API Gateway event', { event: eventSummary });
      break;
    case 'warn':
      logger.warn('API Gateway event', { event: eventSummary });
      break;
    case 'error':
      logger.error('API Gateway event', { event: eventSummary });
      break;
    case 'info':
    default:
      logger.info('API Gateway event', { event: eventSummary });
  }
}
