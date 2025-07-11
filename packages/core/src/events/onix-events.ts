import { EventEmitter } from 'events';

import { Task } from '../tasks/task.js';
import { Host } from '../inventory/host.js';
import { OnixError } from '../errors/error.js';
import { OnixContext } from '../types/common.js';
import { taskCounter, taskDuration, errorCounter, playbookCounter } from '../logging/metrics.js';

export enum OnixEvent {
  TaskStart = 'task:start',
  TaskComplete = 'task:complete',
  TaskError = 'task:error',
  PlaybookStart = 'playbook:start',
  PlaybookComplete = 'playbook:complete',
  ErrorOccurred = 'error:occurred',
}

export interface ErrorEventPayload {
  error: OnixError;
  context: OnixContext;
  meta?: Record<string, any>;
}

export interface TaskEventPayload {
  task: Task;
  host: Host;
  timestamp: Date;
  error?: Error;
  dryRun?: boolean;
}

export interface PlaybookEventPayload {
  playbookName: string;
  timestamp: Date;
  dryRun?: boolean;
}

export const OnixEvents = new EventEmitter();

// Дополнительная логика для метрик
const taskTimers = new Map<string, number>();

OnixEvents.on(OnixEvent.ErrorOccurred, ({ error, context }: ErrorEventPayload) => {
  const { logger, config, alertingService } = context;

  logger.error(`Global error: ${error.message}`, {
    code: error.code,
    details: error.details,
    stack: error.stack,
  });

  errorCounter.labels(error.code || 'UNKNOWN_ERROR').inc();

  if (config.alertingEnabled && alertingService) {
    alertingService.sendAlert({
      severity: 'critical',
      title: `Onix Error: ${error.message}`,
      details: {
        code: error.code,
        details: error.details,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
    }).catch(alertError => {
      logger.warn('Failed to send alert', { alertError });
    });
  }
});

OnixEvents.on(OnixEvent.TaskStart, ({ task, host }: TaskEventPayload) => {
  const key = `${task.name}:${host.hostname}`;
  taskTimers.set(key, Date.now());
});

OnixEvents.on(OnixEvent.TaskComplete, ({ task, host }: TaskEventPayload) => {
  const key = `${task.name}:${host.hostname}`;
  const start = taskTimers.get(key);
  if (start) {
    const duration = (Date.now() - start) / 1000; // в секундах
    taskDuration.labels(task.name, host.hostname).observe(duration);
    taskTimers.delete(key);
  }
  taskCounter.labels(task.name, host.hostname, 'success').inc();
});

OnixEvents.on(OnixEvent.TaskError, ({ task, host }: TaskEventPayload) => {
  const key = `${task.name}:${host.hostname}`;
  const start = taskTimers.get(key);
  if (start) {
    const duration = (Date.now() - start) / 1000;
    taskDuration.labels(task.name, host.hostname).observe(duration);
    taskTimers.delete(key);
  }
  taskCounter.labels(task.name, host.hostname, 'error').inc();
});

OnixEvents.on(OnixEvent.PlaybookStart, ({ playbookName }: PlaybookEventPayload) => {
  playbookCounter.labels(playbookName, 'started').inc();
});

OnixEvents.on(OnixEvent.PlaybookComplete, ({ playbookName }: PlaybookEventPayload) => {
  playbookCounter.labels(playbookName, 'completed').inc();
});
