import { Host } from '../inventory/host.js';
import { Task, TaskOptions } from './task.js';
import { OnixResult, OnixContext } from '../types/common.js';

export class CompositeTask extends Task {
  constructor(private tasks: Task[], options?: TaskOptions) {
    super(options);
  }

  protected async execute(host: Host, context: OnixContext): Promise<OnixResult> {
    const results: OnixResult[] = [];

    for (const task of this.tasks) {
      const result = await task.executeWithRetry(host, context);
      results.push(result);

      if (!result.success && !context.config.dryRun) {
        return {
          success: false,
          data: results,
          error: result.error,
        };
      }
    }

    return { success: true, data: results };
  }

  public async rollback(host: Host, context: OnixContext): Promise<OnixResult> {
    context.logger.info(`Rolling back CompositeTask "${this.name}" on host "${host.hostname}"`);

    const rollbackResults: OnixResult[] = [];

    for (const task of [...this.tasks].reverse()) {
      try {
        const result = await task.rollback(host, context);
        rollbackResults.push(result);

        if (!result.success) {
          context.logger.warn(`Rollback failed for subtask "${task.name}" on host "${host.hostname}"`, {
            error: result.error,
          });
          return {
            success: false,
            data: rollbackResults,
            error: result.error,
          };
        }
      } catch (error: any) {
        context.logger.error(`Exception during rollback of subtask "${task.name}"`, {
          error,
        });
        return {
          success: false,
          data: rollbackResults,
          error,
        };
      }
    }

    return {
      success: true,
      data: rollbackResults,
    };
  }
}
