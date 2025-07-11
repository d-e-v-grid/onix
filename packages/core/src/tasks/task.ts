import { Host } from '../inventory/host.js';
import { OnixError } from '../errors/error.js';
import { OnixResult, OnixContext } from '../types/common.js';
import { OnixEvent, OnixEvents, TaskEventPayload } from '../events/onix-events.js';

export interface TaskOptions {
  name?: string;
  timeout?: number;
  retries?: number;
}

export abstract class Task {
  public readonly name: string;
  public readonly timeout: number;
  public readonly retries: number;

  constructor(options?: TaskOptions) {
    this.name = options?.name || this.constructor.name;
    this.timeout = options?.timeout ?? 30000;
    this.retries = options?.retries ?? 0;
  }

  protected abstract execute(host: Host, context: OnixContext): Promise<OnixResult>;

  public abstract rollback(host: Host, context: OnixContext): Promise<OnixResult>;

  public async executeWithRetry(host: Host, context: OnixContext): Promise<OnixResult> {
    let attempts = 0;
    let lastError: OnixError | undefined;

    while (attempts <= this.retries) {
      const payload: TaskEventPayload = {
        task: this,
        host,
        timestamp: new Date(),
        dryRun: context.config.dryRun
      };

      try {
        OnixEvents.emit(OnixEvent.TaskStart, payload);
        context.logger.info(`Task "${this.name}" started on "${host.hostname}"`, {
          dryRun: context.config.dryRun,
          attempt: attempts + 1,
          maxAttempts: this.retries + 1,
        });

        if (context.config.dryRun) {
          OnixEvents.emit(OnixEvent.TaskComplete, payload);
          context.logger.info(`[DRY-RUN] Task "${this.name}" simulated successfully on "${host.hostname}"`);
          return { success: true, data: 'dry-run' };
        }

        const result = await this.execute(host, context);

        if (result.success) {
          OnixEvents.emit(OnixEvent.TaskComplete, payload);
          context.logger.info(`Task "${this.name}" completed successfully on "${host.hostname}"`);
          return result;
        } else {
          throw result.error || new OnixError('TASK_EXECUTION_FAILED', `Task "${this.name}" failed without specific error`);
        }

      } catch (error: any) {
        attempts += 1;

        lastError = error instanceof OnixError
          ? error
          : new OnixError('UNHANDLED_TASK_EXCEPTION', error.message, { stack: error.stack });

        context.errorHandler.handleError(lastError, {
          task: this.name,
          host: host.hostname,
          attempt: attempts,
          retries: this.retries,
        });

        OnixEvents.emit(OnixEvent.TaskError, {
          ...payload,
          error: lastError,
        });

        if (attempts > this.retries) {
          context.logger.warn(`Retries exhausted for task "${this.name}" on host "${host.hostname}". Initiating rollback.`);
          await this.rollback(host, context);
          return { success: false, error: lastError };
        } else {
          context.logger.warn(`Retrying task "${this.name}" on host "${host.hostname}" (attempt ${attempts + 1}/${this.retries + 1})`);
        }
      }
    }

    return {
      success: false,
      error: lastError || new OnixError('UNKNOWN_TASK_FAILURE', `Unknown error occurred in task "${this.name}"`),
    };
  }
}
