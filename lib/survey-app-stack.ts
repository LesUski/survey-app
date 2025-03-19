import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { ApiConstruct } from './constructs/api-constructs';
import { AuthConstruct } from './constructs/auth-constructs';
import { StorageConstruct } from './constructs/storage-constructs';

interface SurveyAppStackProps extends cdk.StackProps {
  stage: string;
}

export class SurveyAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SurveyAppStackProps) {
    super(scope, id, props);

    // Define the stage name for resource naming
    const stageName = props.stage;
    const isProd = stageName === 'prod';

    // Create the storage resources (DynamoDB tables)
    const storage = new StorageConstruct(this, 'Storage', {
      stage: stageName,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create the authentication resources (Cognito)
    const auth = new AuthConstruct(this, 'Auth', {
      stage: stageName,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create the API resources and connect them to storage and auth
    const api = new ApiConstruct(this, 'Api', {
      stage: stageName,
      surveysTable: storage.surveysTable,
      responsesTable: storage.responsesTable,
      userSettingsTable: storage.userSettingsTable,
      userPool: auth.userPool,
    });

    // Grant the authenticated users access to their own surveys and responses
    storage.surveysTable.grantReadWriteData(auth.authenticatedRole);
    storage.responsesTable.grantReadWriteData(auth.authenticatedRole);
    storage.userSettingsTable.grantReadWriteData(auth.authenticatedRole);

    // Output important resource information
    new cdk.CfnOutput(this, 'StageName', {
      value: stageName,
      description: 'The stage/environment name for this deployment',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: auth.userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: auth.userPoolClient.userPoolClientId,
      description: 'The ID of the Cognito User Pool Client',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: auth.identityPool.ref,
      description: 'The ID of the Cognito Identity Pool',
    });

    new cdk.CfnOutput(this, 'SurveysTableName', {
      value: storage.surveysTable.tableName,
      description: 'The name of the Surveys DynamoDB table',
    });

    new cdk.CfnOutput(this, 'ResponsesTableName', {
      value: storage.responsesTable.tableName,
      description: 'The name of the Responses DynamoDB table',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
      description: 'The URL of the API Gateway endpoint',
    });
  }
}
