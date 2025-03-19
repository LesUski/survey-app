import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';

import { assertIsError } from '../commons/helpers/utils';
import { logger } from '../commons/powertools/logger';

// Interface for answer to a question
export interface Answer {
  questionId: string;
  value: string | string[]; // Can be a single value or array for multi-select
}

// Interface for response metadata
export interface ResponseMetadata {
  source?: string;
  userAgent?: string;
  ipAddress?: string;
  browser?: string;
  os?: string;
  device?: string;
  [key: string]: any; // Allow custom metadata
}

// Define the Response schema
export const ResponseSchema = new dynamoose.Schema({
  responseId: {
    type: String,
    hashKey: true, // Primary key
    required: true,
  },
  surveyId: {
    type: String,
    index: {
      name: 'SurveyIndex',
      type: 'global',
    },
    required: true,
  },
  answers: {
    type: Array,
    schema: [
      {
        type: Object,
        schema: {
          questionId: {
            type: String,
            required: true,
          },
          value: {
            type: String,
            required: true,
          },
        },
      },
    ],
    required: true,
  },
  respondentId: {
    type: String,
    required: false, // Can be null for anonymous responses
  },
  submittedAt: {
    type: String,
    required: true,
  },
  metadata: {
    type: Object,
    required: false,
    default: {},
  },
  ipAddress: {
    type: String,
    required: false,
  },
  userAgent: {
    type: String,
    required: false,
  },
});

// Interface for Survey Response item
export interface ResponseItem extends Item {
  responseId: string;
  surveyId: string;
  answers: Answer[];
  respondentId?: string;
  submittedAt: string;
  metadata?: ResponseMetadata;
  ipAddress?: string;
  userAgent?: string;
}

// Initialize the Response model
const RESPONSES_TABLE = process.env.RESPONSES_TABLE || 'SurveyApp-Responses-dev';

// Check if we're running in a LocalStack environment
const isLocal = process.env.IS_LOCAL === 'true';

// Configure DynamoDB instance if it hasn't been configured by survey model
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

// Create Response model
export const ResponseModel = dynamoose.model<ResponseItem>(RESPONSES_TABLE, ResponseSchema, {
  create: false, // Don't create the table, assume it exists
  waitForActive: false, // Don't wait for the table to be active
});

// Helper functions
export const getResponseById = async (responseId: string): Promise<ResponseItem | null> => {
  try {
    return await ResponseModel.get(responseId);
  } catch (error) {
    assertIsError(error);
    logger.error('Error getting response by ID:', error);
    return null;
  }
};

export const createResponse = async (
  response: Partial<ResponseItem>
): Promise<ResponseItem | null> => {
  try {
    return await ResponseModel.create(response);
  } catch (error) {
    assertIsError(error);
    logger.error('Error creating response:', error);
    return null;
  }
};

export const getResponsesBySurveyId = async (surveyId: string): Promise<ResponseItem[]> => {
  try {
    return await ResponseModel.query('surveyId').eq(surveyId).using('SurveyIndex').exec();
  } catch (error) {
    assertIsError(error);
    logger.error('Error getting responses by survey ID:', error);
    return [];
  }
};
