#!/bin/bash
set -e

echo "🚀 Deploying CDK stack to LocalStack..."

# Create the tmp directory if it doesn't exist
mkdir -p ./tmp/localstack

# Set LocalStack environment variables
export CDK_LOCAL=true
export IS_LOCAL=true
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Clean previous build directories
echo "Cleaning previous builds..."
npm run clean

# Compile TypeScript files
echo "Compiling TypeScript files..."
npm run build
npm run build:lambda

# Bootstrap CDK in LocalStack
echo "Bootstrapping CDK in LocalStack..."
npx cdklocal bootstrap

# Deploy the stack
echo "Deploying stack to LocalStack..."
npx cdklocal deploy SurveyApp-dev --require-approval never

echo "✅ Deployment complete!"