import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { Survey, SurveyResults, Answer, QuestionType } from './types';

/**
 * Client for interacting with the Survey API in integration tests
 */
export class SurveyApiClient {
  private client: AxiosInstance;
  private userId: string;

  constructor(baseURL: string, userId: string = 'test-user-' + uuidv4()) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-user-id': userId, // Used for LocalStack testing
      },
    });
    this.userId = userId;
  }

  /**
   * Get user ID used for authentication
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Create a new survey
   */
  async createSurvey(survey: Partial<Survey>): Promise<Survey> {
    const response: AxiosResponse<Survey> = await this.client.post('/surveys', survey);
    return response.data;
  }

  /**
   * Update an existing survey
   */
  async updateSurvey(surveyId: string, updates: Partial<Survey>): Promise<Survey> {
    // Use POST with path parameter for updates since API Gateway is configured that way
    const response: AxiosResponse<Survey> = await this.client.post(`/surveys/${surveyId}`, updates);
    return response.data;
  }

  /**
   * Get a survey by ID
   */
  async getSurvey(surveyId: string): Promise<Survey> {
    const response: AxiosResponse<Survey> = await this.client.get(`/surveys/${surveyId}`);
    return response.data;
  }

  /**
   * List all accessible surveys
   */
  async listSurveys(): Promise<Survey[]> {
    const response: AxiosResponse<Survey[]> = await this.client.get('/surveys');
    return response.data;
  }

  /**
   * Submit a response to a survey
   */
  async submitResponse(
    surveyId: string,
    answers: Answer[],
    metadata: Record<string, any> = {}
  ): Promise<{ message: string; responseId: string }> {
    const response: AxiosResponse<{ message: string; responseId: string }> = await this.client.post(
      `/surveys/${surveyId}/responses`,
      {
        answers,
        metadata,
      }
    );
    return response.data;
  }

  /**
   * Get survey results
   */
  async getSurveyResults(surveyId: string): Promise<SurveyResults> {
    const response: AxiosResponse<SurveyResults> = await this.client.get(
      `/surveys/${surveyId}/results`
    );
    return response.data;
  }

  /**
   * Generate a random test survey
   */
  generateTestSurvey(title: string = 'Test Survey ' + uuidv4().substring(0, 8)): Survey {
    return {
      title,
      description: 'Generated test survey for integration tests',
      questions: [
        {
          id: 'q1',
          text: 'What do you think of this test?',
          type: QuestionType.TEXT,
          required: true,
        },
        {
          id: 'q2',
          text: 'How would you rate this test?',
          type: QuestionType.RATING,
          required: true,
        },
        {
          id: 'q3',
          text: 'Select all that apply:',
          type: QuestionType.CHECKBOX,
          required: false,
          choices: [
            { id: 'c1', text: 'Easy to use' },
            { id: 'c2', text: 'Well designed' },
            { id: 'c3', text: 'Needs improvement' },
          ],
        },
      ],
      isActive: true,
      isPublic: false,
    };
  }

  /**
   * Generate random answers for a survey
   */
  generateRandomAnswers(survey: Survey): Answer[] {
    return survey.questions.map(question => {
      let value: string | string[];

      switch (question.type) {
        case QuestionType.TEXT:
          value = `Answer to ${question.text} - ${uuidv4().substring(0, 8)}`;
          break;
        case QuestionType.RATING:
          value = Math.floor(Math.random() * 5 + 1).toString();
          break;
        case QuestionType.CHECKBOX:
          if (question.choices && question.choices.length > 0) {
            // Randomly select 1-3 choices
            const numChoices = Math.floor(Math.random() * Math.min(3, question.choices.length)) + 1;
            const shuffled = [...question.choices].sort(() => 0.5 - Math.random());
            value = shuffled.slice(0, numChoices).map(c => c.id);
          } else {
            value = [];
          }
          break;
        case QuestionType.MULTIPLE_CHOICE:
          if (question.choices && question.choices.length > 0) {
            // Random choice
            const randomIndex = Math.floor(Math.random() * question.choices.length);
            value = question.choices[randomIndex].id;
          } else {
            value = '';
          }
          break;
        default:
          value = `Default answer for ${question.type}`;
      }

      return {
        questionId: question.id,
        value,
      };
    });
  }
}
