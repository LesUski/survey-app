import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface ApiConstructProps {
  stage: string;
  surveysTable: dynamodb.Table;
  responsesTable: dynamodb.Table;
  userSettingsTable: dynamodb.Table;
  userPool: cognito.UserPool;
}

export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { stage, surveysTable, responsesTable, userPool } = props;

    // Check if we're running in LocalStack
    const isLocal = process.env.CDK_LOCAL === 'true' || process.env.IS_LOCAL === 'true';

    // Create REST API
    this.api = new apigateway.RestApi(this, 'SurveyApi', {
      restApiName: `survey-app-api-${stage}`,
      description: `Survey App API - ${stage} environment`,
      deployOptions: {
        stageName: stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict to specific origins in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });

    // Define method options based on environment
    let methodOptions: apigateway.MethodOptions;

    if (isLocal) {
      // For LocalStack, use API Key auth instead of Cognito to avoid compatibility issues
      console.log('Running in LocalStack - Using API Key authentication instead of Cognito');

      // Create API Key
      const apiKey = this.api.addApiKey('DevApiKey', {
        apiKeyName: `survey-app-api-key-${stage}`,
        description: 'API Key for local development',
        value: 'test-api-key-local-xyz-753',
      });

      // Create usage plan
      const usagePlan = this.api.addUsagePlan('DevUsagePlan', {
        name: `survey-app-usage-plan-${stage}`,
        apiStages: [
          {
            api: this.api,
            stage: this.api.deploymentStage,
          },
        ],
      });

      // Associate API key with usage plan
      usagePlan.addApiKey(apiKey);

      // Use API Key authentication for local environment
      methodOptions = {
        apiKeyRequired: true,
      };
    } else {
      // For AWS cloud environment, use Cognito
      const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'SurveyAuthorizer', {
        cognitoUserPools: [userPool],
      });

      methodOptions = {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      };
    }

    const powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'powertools-layer',
      `arn:aws:lambda:${Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:3`
    );

    // Common environment variables
    const commonEnvironment: Record<string, string> = {
      STAGE: stage,
      IS_LOCAL: isLocal ? 'true' : 'false',
      LOG_LEVEL: props.stage === 'prod' ? 'info' : 'debug',
    };

    // Add AWS_ENDPOINT_URL for LocalStack
    if (isLocal) {
      commonEnvironment.AWS_ENDPOINT_URL = 'http://localhost:4566';
    }

    // 1. Create/Update Surveys Lambda
    const createSurveyLambda = new NodejsFunction(this, 'CreateSurveyFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/handlers/createsurvey.ts'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ...commonEnvironment,
        SURVEYS_TABLE: surveysTable.tableName,
      },
      layers: [powertoolsLayer],
    });
    surveysTable.grantReadWriteData(createSurveyLambda);

    // 2. Get Surveys Lambda
    const getSurveysLambda = new NodejsFunction(this, 'GetSurveysFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/handlers/getsurveys.ts'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ...commonEnvironment,
        SURVEYS_TABLE: surveysTable.tableName,
      },
      layers: [powertoolsLayer],
    });
    surveysTable.grantReadData(getSurveysLambda);

    // 3. Submit Survey Response Lambda
    const submitResponseLambda = new NodejsFunction(this, 'SubmitResponseFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/handlers/submitresponse.ts'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ...commonEnvironment,
        RESPONSES_TABLE: responsesTable.tableName,
        SURVEYS_TABLE: surveysTable.tableName,
      },
      layers: [powertoolsLayer],
    });
    responsesTable.grantWriteData(submitResponseLambda);
    surveysTable.grantReadData(submitResponseLambda);

    // 4. Get Survey Results Lambda
    const getSurveyResultsLambda = new NodejsFunction(this, 'GetSurveyResultsFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/handlers/getsurveyresults.ts'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        ...commonEnvironment,
        RESPONSES_TABLE: responsesTable.tableName,
        SURVEYS_TABLE: surveysTable.tableName,
      },
      layers: [powertoolsLayer],
    });
    responsesTable.grantReadData(getSurveyResultsLambda);
    surveysTable.grantReadData(getSurveyResultsLambda);

    // Create API Resources and Methods

    // Surveys resource
    const surveysResource = this.api.root.addResource('surveys');

    // GET /surveys
    surveysResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getSurveysLambda),
      methodOptions
    );

    // POST /surveys
    surveysResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createSurveyLambda),
      methodOptions
    );

    // Single survey resource
    const surveyResource = surveysResource.addResource('{surveyId}');

    // GET /surveys/{surveyId}
    surveyResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getSurveysLambda),
      methodOptions
    );

    // PUT /surveys/{surveyId}
    surveyResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(createSurveyLambda),
      methodOptions
    );

    // Responses resource
    const responsesResource = surveyResource.addResource('responses');

    // POST /surveys/{surveyId}/responses - this endpoint can remain open for anonymous responses
    responsesResource.addMethod('POST', new apigateway.LambdaIntegration(submitResponseLambda));

    // Results resource
    const resultsResource = surveyResource.addResource('results');

    // GET /surveys/{surveyId}/results
    resultsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getSurveyResultsLambda),
      methodOptions
    );

    // Health check endpoint
    const healthResource = this.api.root.addResource('health');
    const healthLambda = new lambda.Function(this, 'HealthCheckFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
    exports.handler = async function() {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }
  `),
    });

    healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthLambda));

    // Output API Key if running in LocalStack
    if (isLocal) {
      new cdk.CfnOutput(this, 'ApiKeyId', {
        value: 'DevApiKey',
        description: 'The ID of the API Key for local development',
      });
    }
  }
}
