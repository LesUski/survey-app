// Shared types for integration tests that mirror the model interfaces

// Question types
export enum QuestionType {
  TEXT = 'text',
  MULTIPLE_CHOICE = 'multiple_choice',
  CHECKBOX = 'checkbox',
  RATING = 'rating',
  DATE = 'date',
  EMAIL = 'email',
  NUMBER = 'number',
}

// Choice interface for multiple choice questions
export interface Choice {
  id: string;
  text: string;
  value?: string;
}

// Question interface
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  choices?: Choice[];
  settings?: Record<string, any>;
}

// Survey settings interface
export interface SurveySettings {
  allowAnonymous?: boolean;
  showProgressBar?: boolean;
  showQuestionNumbers?: boolean;
  confirmationMessage?: string;
  redirectUrl?: string;
  theme?: string;
  customCss?: string;
}

// Survey interface for API requests/responses
export interface Survey {
  surveyId?: string;
  title: string;
  description?: string;
  questions: Question[];
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  isPublic?: boolean;
  responseCount?: number;
  settings?: SurveySettings;
}

// Answer interface for survey responses
export interface Answer {
  questionId: string;
  value: string | string[]; // Can be a single value or array for multi-select
}

// Response metadata interface
export interface ResponseMetadata {
  source?: string;
  userAgent?: string;
  ipAddress?: string;
  browser?: string;
  os?: string;
  device?: string;
  [key: string]: any; // Allow custom metadata
}

// Survey response interface
export interface SurveyResponse {
  responseId?: string;
  surveyId: string;
  answers: Answer[];
  respondentId?: string;
  submittedAt?: string;
  metadata?: ResponseMetadata;
  ipAddress?: string;
  userAgent?: string;
}

// Survey results interface
export interface SurveyResults {
  surveyId: string;
  title: string;
  responseCount: number;
  questions: {
    id: string;
    text: string;
    type: string;
    responses: any[];
  }[];
}

// API Error response
export interface ApiError {
  message: string;
  error?: string;
}
