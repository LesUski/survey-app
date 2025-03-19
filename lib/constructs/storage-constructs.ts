import { RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface StorageConstructProps {
  stage: string;
  removalPolicy?: RemovalPolicy;
}

export class StorageConstruct extends Construct {
  public readonly surveysTable: dynamodb.Table;
  public readonly responsesTable: dynamodb.Table;
  public readonly userSettingsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    const { stage, removalPolicy = RemovalPolicy.DESTROY } = props;
    const isProd = stage === 'prod';

    // Create the Surveys table
    this.surveysTable = new dynamodb.Table(this, 'SurveysTable', {
      tableName: `SurveyApp-Surveys-${stage}`,
      partitionKey: { name: 'surveyId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand capacity for cost efficiency
      removalPolicy: isProd ? RemovalPolicy.RETAIN : removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
      timeToLiveAttribute: 'ttl', // Optional TTL for expiring surveys
    });

    // Add GSI for querying surveys by owner
    this.surveysTable.addGlobalSecondaryIndex({
      indexName: 'OwnerIndex',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create the Responses table
    this.responsesTable = new dynamodb.Table(this, 'ResponsesTable', {
      tableName: `SurveyApp-Responses-${stage}`,
      partitionKey: { name: 'responseId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
    });

    // Add GSI for querying responses by surveyId
    this.responsesTable.addGlobalSecondaryIndex({
      indexName: 'SurveyIndex',
      partitionKey: { name: 'surveyId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for querying responses by respondent (if authenticated)
    this.responsesTable.addGlobalSecondaryIndex({
      indexName: 'RespondentIndex',
      partitionKey: {
        name: 'respondentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create User Settings table for additional user preferences/data beyond Cognito
    this.userSettingsTable = new dynamodb.Table(this, 'UserSettingsTable', {
      tableName: `SurveyApp-UserSettings-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : removalPolicy,
      pointInTimeRecoverySpecification: isProd ? { pointInTimeRecoveryEnabled: true } : undefined,
    });
  }
}
