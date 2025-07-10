import { z } from 'zod';
import { readdirSync } from 'fs';
import { join, extname, basename } from 'path';

import { Task } from '../../tasks/task.js';
import { CopyTask } from '../../tasks/copy-task.js';
import { ShellTask } from '../../tasks/shell-task.js';
import { Playbook } from '../../playbooks/playbook.js';
import { FileLoader } from '../../utils/file-loader.js';

// Zod схемы для задач
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

const taskSchema = z.union([shellTaskSchema, copyTaskSchema]);

const playbookSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  tasks: z.array(taskSchema),
});
export class PlaybookLoader {
  static load(playbooksDir: string): Record<string, Playbook> {
    const playbooks: Record<string, Playbook> = {};
    const files = readdirSync(playbooksDir);

    files.forEach((file) => {
      const filePath = join(playbooksDir, file);
      if (['.yml', '.yaml', '.json'].includes(extname(file))) {
        const data = FileLoader.loadFile(filePath, playbookSchema);
        const tasks = data.tasks.map(config => PlaybookLoader.createTask(config));
        const playbookName = data.name || basename(file, extname(file));
        playbooks[playbookName] = new Playbook(tasks, {
          name: playbookName,
          description: data.description,
        });
      }
    });

    return playbooks;
  }

  private static createTask(config: z.infer<typeof taskSchema>): Task {
    switch (config.type) {
      case 'shell':
        return new ShellTask({
          command: config.command,
          args: config.args,
          rollbackCommand: config.rollbackCommand,
          timeout: config.timeout,
          retries: config.retries,
        });
      case 'copy':
        return new CopyTask({
          localPath: config.localPath,
          remotePath: config.remotePath,
          rollbackRemotePath: config.rollbackRemotePath,
          timeout: config.timeout,
          retries: config.retries,
        });
      default:
        throw new Error(`Unsupported task type: ${(config as any).type}`);
    }
  }
}