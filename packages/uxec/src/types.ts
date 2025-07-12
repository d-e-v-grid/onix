import type { ExecutionResult } from './core/result.js';
import type { Command, SSHAdapterOptions, DockerAdapterOptions } from './core/command.js';

// Callable ExecutionEngine interface
export interface CallableExecutionEngine {
  // Make it callable
  (strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult>;
  
  // All ExecutionEngine methods
  execute(command: Command): Promise<ExecutionResult>;
  run(strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult>;
  with(config: Partial<Command>): CallableExecutionEngine;
  ssh(options: Omit<SSHAdapterOptions, 'type'>): CallableExecutionEngine;
  docker(options: Omit<DockerAdapterOptions, 'type'>): CallableExecutionEngine;
  local(): CallableExecutionEngine;
  cd(dir: string): CallableExecutionEngine;
  env(env: Record<string, string>): CallableExecutionEngine;
  timeout(ms: number): CallableExecutionEngine;
  shell(shell: string | boolean): CallableExecutionEngine;
  which(command: string): Promise<string | null>;
  isCommandAvailable(command: string): Promise<boolean>;
  dispose(): Promise<void>;
  getAdapter(name: string): any;
  registerAdapter(name: string, adapter: any): void;
  createProcessPromise(command: Command): any;
}