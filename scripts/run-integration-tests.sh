#!/bin/bash
set -e

echo "Starting integration tests..."

# Check if LocalStack is already running
echo "Checking if LocalStack is running..."
if curl -s http://localhost:4566/health > /dev/null; then
  echo "LocalStack is already running."
else
  echo "Starting LocalStack..."
  localstack start -d
  
  # Wait for LocalStack to be ready
  echo "Waiting for LocalStack to be ready..."
  for i in {1..30}; do
    if curl -s http://localhost:4566/health > /dev/null; then
      echo "LocalStack is running and ready."
      break
    fi
    
    if [ $i -eq 30 ]; then
      echo "Error: LocalStack failed to start after 30 seconds."
      exit 1
    fi
    
    echo "Waiting... ($i/30)"
    sleep 1
  done
fi

# Deploy the CDK app to LocalStack
echo "Deploying CDK app to LocalStack..."
cd "$(dirname "$0")/.." # Navigate to project root
cdklocal deploy --all --require-approval never

# Run the integration tests
echo "Running integration tests..."
npm run test:integration

echo "Integration tests completed!"