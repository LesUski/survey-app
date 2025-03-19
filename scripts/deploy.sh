#!/bin/bash
set -e

# Get the target environment from arguments or default to 'dev'
ENV=${1:-dev}
TARGET=${2:-localstack}  # Default to localstack if not specified
PROFILE=${3:-default}    # Default to 'default' AWS profile if not specified

echo "🚀 Deploying CDK stack for environment: $ENV to $TARGET..."

# Set environment variables based on the target
if [ "$TARGET" == "localstack" ]; then
  # LocalStack deployment configuration
  export CDK_LOCAL=true
  export IS_LOCAL=true
  export AWS_ENDPOINT_URL=http://localhost:4566
  export AWS_ACCESS_KEY_ID=test
  export AWS_SECRET_ACCESS_KEY=test
  export AWS_DEFAULT_REGION=us-east-1
  
  echo "Deploying to LocalStack..."
  npx cdklocal bootstrap
  npx cdklocal deploy "SurveyApp-$ENV" --context env=$ENV --require-approval never
else
  # AWS deployment configuration
  unset CDK_LOCAL
  unset IS_LOCAL
  unset AWS_ENDPOINT_URL
  export AWS_DEFAULT_REGION=eu-west-1
  
  echo "Deploying to AWS using profile: $PROFILE in region: $AWS_DEFAULT_REGION"
  
  # Deploy to AWS
  npx cdk bootstrap --profile $PROFILE
  npx cdk deploy "SurveyApp-$ENV" --context env=$ENV --profile $PROFILE
fi
