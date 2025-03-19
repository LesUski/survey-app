import { exec } from 'child_process';
import { promisify } from 'util';

import axios from 'axios';

const execAsync = promisify(exec);

/**
 * Checks if LocalStack is running and accessible
 */
export async function isLocalStackRunning(): Promise<boolean> {
  try {
    console.log('Checking if LocalStack is running at http://localhost:4566/health');
    const response = await axios.get('http://localhost:4566/health', {
      timeout: 3000,
    });
    console.log('LocalStack health response:', response.status, response.data);
    return response.status === 200;
  } catch (error) {
    console.error('Error checking LocalStack health:', error);
    return false;
  }
}

/**
 * Starts LocalStack if it's not already running
 */
export async function ensureLocalStackRunning(): Promise<void> {
  if (await isLocalStackRunning()) {
    console.log('LocalStack is already running');
    return;
  }

  console.log('Starting LocalStack...');
  try {
    // Start LocalStack in detached mode
    await execAsync('localstack start -d');

    // Wait for LocalStack to be ready
    let retries = 0;
    const maxRetries = 30;
    while (retries < maxRetries) {
      if (await isLocalStackRunning()) {
        console.log('LocalStack is running and ready');
        return;
      }
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('LocalStack failed to start after 30 seconds');
  } catch (error) {
    console.error('Failed to start LocalStack:', error);
    throw error;
  }
}

/**
 * Deploys the CDK app to LocalStack
 */
export async function deployCdkAppToLocalStack(): Promise<void> {
  console.log('Deploying CDK app to LocalStack...');
  try {
    const { stdout, stderr } = await execAsync(
      'cd /home/les/Projects/survey-app && cdklocal deploy --all --require-approval never'
    );
    console.log('CDK deploy output:', stdout);
    if (stderr) {
      console.error('CDK deploy stderr:', stderr);
    }
  } catch (error) {
    console.error('Failed to deploy CDK app:', error);
    throw error;
  }
}

/**
 * Gets API Gateway endpoint URL from LocalStack
 */
export async function getApiEndpoint(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'aws --endpoint-url=http://localhost:4566 cloudformation describe-stacks --stack-name SurveyAppStack --query "Stacks[0].Outputs[?OutputKey==\'ApiEndpoint\'].OutputValue" --output text'
    );
    const apiEndpoint = stdout.trim();
    if (!apiEndpoint) {
      throw new Error('API endpoint not found in CloudFormation outputs');
    }
    return apiEndpoint;
  } catch (error) {
    console.error('Failed to get API endpoint:', error);
    throw error;
  }
}

/**
 * Run before all tests to ensure the environment is ready
 */
export async function setupTestEnvironment(): Promise<string> {
  await ensureLocalStackRunning();
  await deployCdkAppToLocalStack();
  return await getApiEndpoint();
}
