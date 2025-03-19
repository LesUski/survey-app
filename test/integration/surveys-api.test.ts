import { v4 as uuidv4 } from 'uuid';

import { SurveyApiClient } from './api-client';
import { Survey, QuestionType } from './types';
import { setupTestEnvironment } from './utils';


describe('Survey API Integration Tests', () => {
  let apiClient: SurveyApiClient;
  let apiEndpoint: string;
  let createdSurveyId: string;

  // Set up the test environment before all tests
  beforeAll(async () => {
    // Use a simplified setup for now that skips LocalStack bootstrapping
    // In real use, uncomment the full setup
    /*
    try {
      apiEndpoint = await setupTestEnvironment();
      console.log(`API endpoint: ${apiEndpoint}`);
      apiClient = new SurveyApiClient(apiEndpoint);
    } catch (error) {
      console.error('Failed to set up test environment:', error);
      throw error;
    }
    */

    // For now, use a hardcoded endpoint from a running instance
    apiEndpoint = 'https://enpchw0sq8.execute-api.localhost.localstack.cloud:4566/dev/';
    console.log(`Using hardcoded API endpoint: ${apiEndpoint}`);
    apiClient = new SurveyApiClient(apiEndpoint);
  }, 120000); // 2 minute timeout for setup

  // Test full API flow
  test('Full survey API flow', async () => {
    // 1. Create a survey
    const surveyToCreate = apiClient.generateTestSurvey();
    const createdSurvey = await apiClient.createSurvey(surveyToCreate);

    expect(createdSurvey).toBeDefined();
    expect(createdSurvey.surveyId).toBeDefined();
    expect(createdSurvey.title).toBe(surveyToCreate.title);
    expect(createdSurvey.questions.length).toBe(surveyToCreate.questions.length);
    expect(createdSurvey.ownerId).toBe(apiClient.getUserId());

    createdSurveyId = createdSurvey.surveyId!;
    console.log(`Created survey with ID: ${createdSurveyId}`);

    // 2. Get the survey by ID
    const retrievedSurvey = await apiClient.getSurvey(createdSurveyId);

    expect(retrievedSurvey).toBeDefined();
    expect(retrievedSurvey.surveyId).toBe(createdSurveyId);
    expect(retrievedSurvey.title).toBe(createdSurvey.title);

    // 3. Update the survey
    const updatedTitle = `Updated Survey ${uuidv4().substring(0, 8)}`;
    const updatedSurvey = await apiClient.updateSurvey(createdSurveyId, {
      title: updatedTitle,
      isPublic: true,
    });

    expect(updatedSurvey).toBeDefined();
    expect(updatedSurvey.title).toBe(updatedTitle);
    expect(updatedSurvey.isPublic).toBe(true);

    // 4. List all surveys
    const surveys = await apiClient.listSurveys();

    expect(surveys).toBeDefined();
    expect(Array.isArray(surveys)).toBe(true);
    expect(surveys.length).toBeGreaterThan(0);
    expect(surveys.some(s => s.surveyId === createdSurveyId)).toBe(true);

    // 5. Submit a response to the survey
    const answers = apiClient.generateRandomAnswers(retrievedSurvey);
    const submittedResponse = await apiClient.submitResponse(createdSurveyId, answers, {
      source: 'integration-test',
    });

    expect(submittedResponse).toBeDefined();
    expect(submittedResponse.responseId).toBeDefined();
    expect(submittedResponse.message).toContain('success');

    // 6. Get survey results
    const results = await apiClient.getSurveyResults(createdSurveyId);

    expect(results).toBeDefined();
    expect(results.surveyId).toBe(createdSurveyId);
    expect(results.responseCount).toBeGreaterThan(0);
    expect(results.questions.length).toBe(retrievedSurvey.questions.length);

    // Verify first question's response
    const firstQuestionResponse = results.questions.find(q => q.id === answers[0].questionId);
    expect(firstQuestionResponse).toBeDefined();
    expect(firstQuestionResponse!.responses).toContain(answers[0].value);
  });

  // Test creating a survey with validation errors
  test('Survey creation validation', async () => {
    // Try to create a survey without a title
    const invalidSurvey = {
      description: 'Survey without a title',
      questions: [
        {
          id: 'q1',
          text: 'Question without a title',
          type: QuestionType.TEXT,
          required: true,
        },
      ],
    };

    try {
      await apiClient.createSurvey(invalidSurvey as Survey);
      fail('Should have thrown an error for missing title');
    } catch (error: any) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toContain('required field');
    }

    // Try to create a survey without questions
    const surveyWithoutQuestions = {
      title: 'Survey without questions',
      questions: [],
    };

    try {
      await apiClient.createSurvey(surveyWithoutQuestions as Survey);
      fail('Should have thrown an error for empty questions array');
    } catch (error: any) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toContain('required field');
    }
  });

  // Test survey permissions
  test('Survey permissions', async () => {
    // Create a new client with a different user
    const otherClient = new SurveyApiClient(apiEndpoint, 'different-user-' + uuidv4());

    // Create a private survey with the original user
    const privateSurvey = apiClient.generateTestSurvey('Private Survey');
    privateSurvey.isPublic = false;

    const createdPrivateSurvey = await apiClient.createSurvey(privateSurvey);
    expect(createdPrivateSurvey.surveyId).toBeDefined();

    // Try to access it with a different user
    try {
      await otherClient.getSurvey(createdPrivateSurvey.surveyId!);
      fail('Should not be able to access private survey of another user');
    } catch (error: any) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(403);
      expect(error.response.data.message).toContain('denied');
    }

    // Now make it public
    await apiClient.updateSurvey(createdPrivateSurvey.surveyId!, {
      isPublic: true,
    });

    // Should now be accessible to the other user
    const publicSurvey = await otherClient.getSurvey(createdPrivateSurvey.surveyId!);
    expect(publicSurvey).toBeDefined();
    expect(publicSurvey.surveyId).toBe(createdPrivateSurvey.surveyId);

    // Try to update it with the other user
    try {
      await otherClient.updateSurvey(createdPrivateSurvey.surveyId!, {
        title: 'Tried to update from another user',
      });
      fail('Should not be able to update survey of another user');
    } catch (error: any) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(403);
      expect(error.response.data.message).toContain('permission');
    }
  });

  // Test survey responses
  test('Survey responses and results', async () => {
    // Create a survey for responses
    const survey = apiClient.generateTestSurvey('Response Test Survey');
    const createdSurvey = await apiClient.createSurvey(survey);
    expect(createdSurvey.surveyId).toBeDefined();

    // Submit multiple responses
    const responseCount = 3;
    const responsePromises = [];

    for (let i = 0; i < responseCount; i++) {
      const answers = apiClient.generateRandomAnswers(createdSurvey);
      responsePromises.push(
        apiClient.submitResponse(createdSurvey.surveyId!, answers, { responseNumber: i + 1 })
      );
    }

    const responses = await Promise.all(responsePromises);
    expect(responses.length).toBe(responseCount);
    expect(responses.every(r => r.responseId)).toBe(true);

    // Get survey results
    const results = await apiClient.getSurveyResults(createdSurvey.surveyId!);
    expect(results).toBeDefined();
    expect(results.responseCount).toBe(responseCount);

    // Check that all questions have responses
    expect(results.questions.length).toBe(survey.questions.length);
    expect(results.questions.every(q => q.responses.length === responseCount)).toBe(true);
  });
});
