/**
 * Service name for the application to use in logs, metrics, and traces.
 *
 * Can also be configured via POWERTOOLS_SERVICE_NAME environment variable.
 */
const serviceName = 'SurveyApp';
/**
 * Namespace for metrics to use in metrics.
 *
 * Can also be configured via POWERTOOLS_METRICS_NAMESPACE environment variable.
 */
const metricsNamespace = 'surveyapp';
/**
 * Key-value pairs to include in all metrics and logs.
 */
const defaultValues = {
  executionEnv: process.env.AWS_EXECUTION_ENV || 'N/A',
};

export { serviceName, metricsNamespace, defaultValues };
