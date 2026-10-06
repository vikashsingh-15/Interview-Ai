import logger from '../../config/logger';

/**
 * Run a background/startup job with uniform lifecycle logging: start,
 * success with duration, or failure with the full error and context. Failures
 * re-throw so callers keep their existing control flow — the log entry is the
 * visibility, not a behaviour change.
 */
export async function runJob<T>(name: string, context: Record<string, unknown>,
  fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  logger.info('Job started', { module: 'job', job: name, ...context });
  try {
    const result = await fn();
    logger.info('Job succeeded', { module: 'job', job: name, durationMs: Date.now() - started, ...context });
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Job failed', {
      module: 'job', job: name, durationMs: Date.now() - started, ...context,
      error: err.message, stack: err.stack,
    });
    throw error;
  }
}
