import { Task } from '../tasks/task.js';
import { Playbook } from './playbook.js';
import { Host } from '../inventory/host.js';
import { OnixResult, OnixContext } from '../types/common.js';
import { OnixEvent, OnixEvents, PlaybookEventPayload } from '../events/onix-events.js';

export class PlaybookRunner {
  constructor(private context: OnixContext) { }

  async run(playbook: Playbook, hosts: Host[]): Promise<Record<string, OnixResult[]>> {
    const results: Record<string, OnixResult[]> = {};

    // Событие запуска плейбука
    OnixEvents.emit(OnixEvent.PlaybookStart, {
      playbookName: playbook.name,
      timestamp: new Date(),
      dryRun: this.context.config.dryRun,
    } as PlaybookEventPayload);

    this.context.logger.info(`Starting playbook "${playbook.name}" execution`, {
      dryRun: this.context.config.dryRun,
      hosts: hosts.map(h => h.hostname),
    });

    for (const host of hosts) {
      results[host.hostname] = [];
      const executedTasks: Task[] = [];

      for (const task of playbook.getTasks()) {
        const result = await task.executeWithRetry(host, this.context);
        results[host.hostname]?.push(result);

        if (result.success) {
          executedTasks.push(task);
        } else {
          this.context.logger.warn(`Task "${task.name}" failed on host "${host.hostname}". Initiating rollback.`);

          // Rollback executed tasks in reverse order
          for (const rollbackTask of executedTasks.reverse()) {
            this.context.logger.info(`Rolling back task "${rollbackTask.name}" on host "${host.hostname}"`);
            await rollbackTask.rollback(host, this.context);
          }

          break; // stop further tasks execution on error
        }
      }
    }

    // Событие завершения плейбука
    OnixEvents.emit(OnixEvent.PlaybookComplete, {
      playbookName: playbook.name,
      timestamp: new Date(),
      dryRun: this.context.config.dryRun,
    } as PlaybookEventPayload);

    this.context.logger.info(`Playbook "${playbook.name}" completed`, {
      dryRun: this.context.config.dryRun,
    });

    return results;
  }
}
