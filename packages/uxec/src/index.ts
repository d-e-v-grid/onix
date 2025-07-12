import { ExecutionResult } from './core/result.js';
import { CallableExecutionEngine } from './types.js';
import { Command, AdapterType, SSHAdapterOptions, DockerAdapterOptions } from './core/command.js';
import { ProcessPromise, ExecutionEngine, ExecutionEngineConfig } from './core/execution-engine.js';

// Re-export types
export type {
  Command,
  AdapterType,
  ProcessPromise,
  ExecutionResult,
  SSHAdapterOptions,
  DockerAdapterOptions,
  ExecutionEngineConfig,
  CallableExecutionEngine
};

// Mock adapter for testing
export { MockAdapter } from './adapters/mock-adapter.js';

// Runtime detection utility
export { RuntimeDetector } from './utils/runtime-detect.js';
// Re-export errors
export {
  DockerError,
  CommandError,
  TimeoutError,
  AdapterError,
  ExecutionError,
  ConnectionError
} from './core/error.js';
export type { SSHAdapterConfig } from './adapters/ssh-adapter.js';

// Helper to wrap ExecutionEngine into a callable function
function wrapEngine(engine: ExecutionEngine): CallableExecutionEngine {
  // Create a function that also has all the methods of ExecutionEngine
  const execFunction = async (strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult> => engine.run(strings, ...values);

  // Copy all methods from engine to the function
  const prototype = Object.getPrototypeOf(engine);
  const propertyNames = Object.getOwnPropertyNames(prototype);
  
  for (const name of propertyNames) {
    if (name !== 'constructor') {
      const prop = (engine as any)[name];
      if (typeof prop === 'function') {
        // These methods return ExecutionEngine, so wrap the result
        if (name === 'with' || name === 'ssh' || name === 'docker' || name === 'local' || name === 'cd' || name === 'env' || name === 'timeout' || name === 'shell') {
          (execFunction as any)[name] = function(...args: any[]) {
            const result = prop.apply(engine, args);
            return wrapEngine(result);
          };
        } else {
          (execFunction as any)[name] = prop.bind(engine);
        }
      }
    }
  }

  // Add static properties
  Object.setPrototypeOf(execFunction, engine);

  return execFunction as any;
}

// Factory function to create execution engine
export function createExecutionEngine(config?: ExecutionEngineConfig): CallableExecutionEngine {
  const engine = new ExecutionEngine(config);
  return wrapEngine(engine);
}

// Default export with global configuration
let defaultEngine: ReturnType<typeof createExecutionEngine> | null = null;

export function getDefaultEngine(): ReturnType<typeof createExecutionEngine> {
  if (!defaultEngine) {
    defaultEngine = createExecutionEngine();
  }
  return defaultEngine;
}

// Configure default engine
export function configure(config: ExecutionEngineConfig): void {
  defaultEngine = createExecutionEngine(config);
}

// Convenience export
export const $ = new Proxy((() => {}) as any, {
  get(target, prop) {
    const engine = getDefaultEngine();
    if (prop in engine) {
      const value = (engine as any)[prop];
      if (typeof value === 'function') {
        return value.bind(engine);
      }
      return value;
    }
    return undefined;
  },
  apply(target, thisArg, argumentsList) {
    const engine = getDefaultEngine();
    return (engine as any)(...argumentsList);
  }
}) as CallableExecutionEngine;

// Additional utility functions
export async function exec(command: string, options?: Partial<Command>): Promise<ExecutionResult> {
  const engine = getDefaultEngine();
  return engine.execute({ command, shell: true, ...options });
}

export async function spawn(command: string, args?: string[], options?: Partial<Command>): Promise<ExecutionResult> {
  const engine = getDefaultEngine();
  return engine.execute({ command, args, shell: false, ...options });
}

// Helper to create engines with specific adapters
export const ssh = (options: Omit<SSHAdapterOptions, 'type'>): CallableExecutionEngine => {
  const engine = getDefaultEngine();
  return engine.ssh(options);
};

export const docker = (options: Omit<DockerAdapterOptions, 'type'>): CallableExecutionEngine => {
  const engine = getDefaultEngine();
  return engine.docker(options);
};

export const local = (): CallableExecutionEngine => {
  const engine = getDefaultEngine();
  return engine.local();
};

// Utility types for better TypeScript support
export interface ExecFunction {
  (strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult>;
  execute(command: Command): Promise<ExecutionResult>;
  run(strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult>;
  with(config: Partial<Command>): ExecFunction;
  ssh(options: Omit<SSHAdapterOptions, 'type'>): ExecFunction;
  docker(options: Omit<DockerAdapterOptions, 'type'>): ExecFunction;
  local(): ExecFunction;
  cd(dir: string): ExecFunction;
  env(env: Record<string, string>): ExecFunction;
  timeout(ms: number): ExecFunction;
  shell(shell: string | boolean): ExecFunction;
  which(command: string): Promise<string | null>;
  isCommandAvailable(command: string): Promise<boolean>;
  dispose(): Promise<void>;
}

// Re-export adapter configs
export type { LocalAdapterConfig } from './adapters/local-adapter.js';
export type { DockerAdapterConfig } from './adapters/docker-adapter.js';

// Export adapters for direct usage
export { BaseAdapter } from './adapters/base-adapter.js';
export { LocalAdapter } from './adapters/local-adapter.js';
export { SSHAdapter } from './adapters/ssh-adapter.js';
export { DockerAdapter } from './adapters/docker-adapter.js';

// Export xs compatibility layer
export { 
  createXsCompatibleShell as createXsShell, 
  type XsOptions,
  type XsProcessPromise
} from './xs-compat/xs-shell.js';
export { ProcessOutput, type ProcessOutputOptions } from './core/process-output.js';