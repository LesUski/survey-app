import * as dynamoose from 'dynamoose';
import { Item } from 'dynamoose/dist/Item';

import { assertIsError } from '../commons/helpers/utils';
import { logger } from '../commons/powertools/logger';

// Question type enum
export enum QuestionType {
  TEXT = 'text',
  MULTIPLE_CHOICE = 'multiple_choice',
  CHECKBOX = 'checkbox',
  RATING = 'rating',
  DATE = 'date',
  EMAIL = 'email',
  NUMBER = 'number',
}

// Interface for choice options in multiple choice questions
export interface Choice {
  id: string;
  text: string;
  value?: string;
}

// Interface for survey questions
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  choices?: Choice[];
  settings?: Record<string, any>;
}

// Interface for survey settings
export interface SurveySettings {
  allowAnonymous?: boolean;
  showProgressBar?: boolean;
  showQuestionNumbers?: boolean;
  confirmationMessage?: string;
  redirectUrl?: string;
  theme?: string;
  customCss?: string;
}

// Define the Survey schema
export const SurveySchema = new dynamoose.Schema(
  {
    surveyId: {
      type: String,
      hashKey: true, // Primary key
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    questions: {
      type: Array,
      schema: [
        {
          type: Object,
          schema: {
            id: {
              type: String,
              required: true,
            },
            text: {
              type: String,
              required: true,
            },
            type: {
              type: String,
              required: true,
              enum: Object.values(QuestionType),
            },
            required: {
              type: Boolean,
              default: false,
            },
            choices: {
              type: Array,
              schema: [
                {
                  type: Object,
                  schema: {
                    id: { type: String, required: true },
                    text: { type: String, required: true },
                    value: { type: String },
                  },
                },
              ],
              required: false,
            },
            settings: {
              type: Object,
              schema: {
                minLength: { type: Number },
                maxLength: { type: Number },
                minValue: { type: Number },
                maxValue: { type: Number },
                step: { type: Number },
                placeholder: { type: String },
              },
              required: false,
            },
          },
        },
      ],
      required: true,
    },
    ownerId: {
      type: String,
      required: true,
    },
    createdAt: {
      type: String,
      required: true,
    },
    updatedAt: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    responseCount: {
      type: Number,
      default: 0,
    },
    settings: {
      type: Object,
      schema: {
        allowAnonymous: { type: Boolean, default: true },
        showProgressBar: { type: Boolean, default: true },
        showQuestionNumbers: { type: Boolean, default: true },
        confirmationMessage: { type: String },
        redirectUrl: { type: String },
        theme: { type: String, default: 'default' },
        customCss: { type: String },
      },
      default: {},
    },
  },
  {
    timestamps: false, // We're using our own createdAt and updatedAt
  }
);

// Interface for Survey item
export interface SurveyItem extends Item {
  surveyId: string;
  title: string;
  description?: string;
  questions: Question[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isPublic: boolean;
  responseCount: number;
  settings?: SurveySettings;
}

// Initialize the Survey model
const SURVEYS_TABLE = process.env.SURVEYS_TABLE || 'SurveyApp-Surveys-dev';

// Check if we're running in a LocalStack environment
const isLocal = process.env.IS_LOCAL === 'true';

// Configure DynamoDB instance
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

// Create Survey model
export const SurveyModel = dynamoose.model<SurveyItem>(SURVEYS_TABLE, SurveySchema, {
  create: false, // Don't create the table, assume it exists
  waitForActive: false, // Don't wait for the table to be active
});

// Helper functions
export const getSurveyById = async (surveyId: string): Promise<SurveyItem | null> => {
  try {
    return await SurveyModel.get(surveyId);
  } catch (error) {
    assertIsError(error);
    logger.error('Error getting survey by ID:', error);
    return null;
  }
};

export const createSurvey = async (survey: Partial<SurveyItem>): Promise<SurveyItem | null> => {
  try {
    return await SurveyModel.create(survey);
  } catch (error) {
    assertIsError(error);
    logger.error('Error creating survey:', error);
    return null;
  }
};

export const updateSurvey = async (
  surveyId: string,
  updates: Partial<SurveyItem>
): Promise<SurveyItem | null> => {
  try {
    // Create a new object without the surveyId
    const { surveyId: _, ...updateWithoutId } = updates;
    return await SurveyModel.update({ surveyId }, updateWithoutId);
  } catch (error) {
    assertIsError(error);
    logger.error('Error updating survey:', error);
    return null;
  }
};

export const deleteSurvey = async (surveyId: string): Promise<void> => {
  try {
    await SurveyModel.delete(surveyId);
  } catch (error) {
    assertIsError(error);
    logger.error('Error deleting survey:', error);
    throw error;
  }
};

export const listSurveys = async (userId?: string, isPublic?: boolean): Promise<SurveyItem[]> => {
  try {
    let query = SurveyModel.scan();

    if (userId) {
      query = query.filter('ownerId').eq(userId);
    }

    if (isPublic !== undefined) {
      query = query.filter('isPublic').eq(isPublic);
    }

    return await query.exec();
  } catch (error) {
    assertIsError(error);
    logger.error('Error listing surveys:', error);
    return [];
  }
};

/**
 * Atomically increment the response count for a survey
 */
export const incrementSurveyResponseCount = async (
  surveyId: string
): Promise<SurveyItem | null> => {
  try {
    // Use Dynamoose update with atomic counter
    return await SurveyModel.update(
      { surveyId },
      {
        $ADD: { responseCount: 1 },
        updatedAt: new Date().toISOString(),
      }
    );
  } catch (error) {
    assertIsError(error);
    logger.error('Error incrementing survey response count:', {
      error: error instanceof Error ? error.message : String(error),
      surveyId,
    });
    return null;
  }
};
