import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface WebsiteConstructProps {
  stage: string;
  apiEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  removalPolicy?: cdk.RemovalPolicy;
}

export class WebsiteConstruct extends Construct {
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebsiteConstructProps) {
    super(scope, id);

    const {
      stage,
      apiEndpoint,
      userPoolId,
      userPoolClientId,
      identityPoolId,
      removalPolicy = cdk.RemovalPolicy.DESTROY,
    } = props;

    const isProd = stage === 'prod';

    // Create S3 bucket for website hosting
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `survey-app-website-${stage}-${cdk.Aws.ACCOUNT_ID}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA - route all errors to index
      publicReadAccess: false, // CloudFront will access it, not public users
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : removalPolicy,
      autoDeleteObjects: !isProd, // Only auto-delete in non-prod environments
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'WebsiteOAI', {
      comment: `OAI for Survey App Website - ${stage}`,
    });

    // Grant read permissions to CloudFront
    this.websiteBucket.grantRead(originAccessIdentity);

    // Create a custom response headers policy
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        responseHeadersPolicyName: `survey-app-security-headers-${stage}`,
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' *.amazonaws.com *.amazoncognito.com;",
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(2 * 365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
      }
    );

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultRootObject: 'index.html',
      enableIpv6: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // Redirect to index for SPA routing
        },
      ],
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(this.websiteBucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    // Deploy the website content (empty at first, will be updated by CI/CD)
    new s3deploy.BucketDeployment(this, 'WebsiteDeployment', {
      sources: [s3deploy.Source.asset('./website/build')], // Path to your frontend build
      destinationBucket: this.websiteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      memoryLimit: 1024,
    });

    // Create a config file for the frontend app
    new s3deploy.BucketDeployment(this, 'AppConfig', {
      sources: [
        s3deploy.Source.jsonData('config.json', {
          apiEndpoint,
          region: cdk.Aws.REGION,
          userPoolId,
          userPoolWebClientId: userPoolClientId,
          identityPoolId,
          stage,
        }),
      ],
      destinationBucket: this.websiteBucket,
      prune: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'Website S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Website URL',
    });
  }
}
