#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { SurveyAppStack } from '../lib/survey-app-stack';

const app = new cdk.App();

// Determine if we're running in LocalStack mode
const isLocalStack = process.env.CDK_LOCAL === 'true' || process.env.IS_LOCAL === 'true';

// Define environment-specific configurations
const envParams = {
  dev: {
    env: {
      // For LocalStack, use a dummy account; for AWS, use the default account from credentials
      account: isLocalStack ? '000000000000' : process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    stage: 'dev',
  },
  prod: {
    env: {
      // For prod, always use the actual AWS account
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    stage: 'prod',
  },
};

// Deploy the stack to the specified environment based on context variable
// Default to 'dev' if not specified
const targetEnv = app.node.tryGetContext('env') || 'dev';
const params = envParams[targetEnv as keyof typeof envParams];

// Create the main survey app stack with environment parameters
new SurveyAppStack(app, `SurveyApp-${params.stage}`, {
  env: params.env,
  stage: params.stage,
  description: `Survey Application - ${params.stage.toUpperCase()} Environment`,
  terminationProtection: params.stage === 'prod',
  tags: {
    Environment: params.stage,
    Project: 'SurveyApp',
    Owner: 'CDK',
  },
});

app.synth();
