import { z } from 'zod';

import { Task } from '../../tasks/task.js';
import { CopyTask } from '../../tasks/copy-task.js';
import { ShellTask } from '../../tasks/shell-task.js';
import { FileLoader } from '../../utils/file-loader.js';
import { CompositeTask } from '../../tasks/composite-task.js';

const shellTaskSchema = z.object({
  type: z.literal('shell'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  rollbackCommand: z.string().optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
});

const copyTaskSchema = z.object({
  type: z.literal('copy'),
  localPath: z.string(),
  remotePath: z.string(),
  rollbackRemotePath: z.string().optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
});

const compositeTaskSchema = z.object({
  type: z.literal('composite'),
  tasks: z.array(z.any()), // рекурсивная проверка будет отдельно
});

const taskSchema = z.union([shellTaskSchema, copyTaskSchema, compositeTaskSchema]);

const tasksSchema = z.record(taskSchema);

export class TaskLoader {
  static load(tasksFilePath: string): Record<string, Task> {
    const data = FileLoader.loadFile(tasksFilePath, tasksSchema);
    const tasks: Record<string, Task> = {};

    Object.entries(data).forEach(([taskName, taskData]) => {
      tasks[taskName] = TaskLoader.parseTask(taskName, taskData);
    });

    return tasks;
  }

  private static parseTask(name: string, taskData: any): Task {
    const parsedTask = taskSchema.parse(taskData);

    switch (parsedTask.type) {
      case 'shell':
        return new ShellTask({
          name,
          command: parsedTask.command,
          args: parsedTask.args,
          rollbackCommand: parsedTask.rollbackCommand,
          timeout: parsedTask.timeout,
          retries: parsedTask.retries,
        });

      case 'copy':
        return new CopyTask({
          name,
          localPath: parsedTask.localPath,
          remotePath: parsedTask.remotePath,
          rollbackRemotePath: parsedTask.rollbackRemotePath,
          timeout: parsedTask.timeout,
          retries: parsedTask.retries,
        });

      case 'composite':
        return new CompositeTask(
          parsedTask.tasks.map((subTaskData: any, idx: number) =>
            TaskLoader.parseTask(`${name}_subtask_${idx}`, subTaskData),
          ),
          { name },
        );

      default:
        {
          const _exhaustiveCheck: never = parsedTask;
          throw new Error(`Unsupported task type: ${JSON.stringify(_exhaustiveCheck)}`);
        }
    }
  }
}
