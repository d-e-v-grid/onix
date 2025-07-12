import { Readable } from 'node:stream';

import { AdapterError } from './error.js';
import { ExecutionResult } from './result.js';
import { interpolate } from '../utils/shell-escape.js';
import { BaseAdapter } from '../adapters/base-adapter.js';
import { SSHAdapter, SSHAdapterConfig } from '../adapters/ssh-adapter.js';
import { LocalAdapter, LocalAdapterConfig } from '../adapters/local-adapter.js';
import { Command, SSHAdapterOptions, DockerAdapterOptions } from './command.js';
import { DockerAdapter, DockerAdapterConfig } from '../adapters/docker-adapter.js';

export interface ExecutionEngineConfig {
  // Global settings
  defaultTimeout?: number;
  defaultCwd?: string;
  defaultEnv?: Record<string, string>;
  defaultShell?: string | boolean;
  
  // Adapter settings
  adapters?: {
    local?: LocalAdapterConfig;
    ssh?: SSHAdapterConfig;
    docker?: DockerAdapterConfig;
  };
  
  // Behavior
  throwOnNonZeroExit?: boolean;
  encoding?: BufferEncoding;
  maxBuffer?: number;
  
  // Runtime specific settings
  runtime?: {
    preferBun?: boolean;
    bunPath?: string;
  };
}

export interface ProcessPromise extends Promise<ExecutionResult> {
  stdout: Readable;
  stderr: Readable;
  stdin: NodeJS.WritableStream;
  pipe(target: ProcessPromise | ExecutionEngine | NodeJS.WritableStream | TemplateStringsArray, ...args: any[]): ProcessPromise;
  signal(signal: AbortSignal): ProcessPromise;
  timeout(ms: number, timeoutSignal?: string): ProcessPromise;
  quiet(): ProcessPromise;
  nothrow(): ProcessPromise;
  interactive(): ProcessPromise;
  kill(signal?: string): void;
  // New methods for zx compatibility
  text(): Promise<string>;
  json<T = any>(): Promise<T>;
  lines(): Promise<string[]>;
  buffer(): Promise<Buffer>;
  // Process-related properties
  child?: any;
  exitCode: Promise<number | null>;
}

export class ExecutionEngine {
  public readonly config: ExecutionEngineConfig;
  private adapters: Map<string, BaseAdapter> = new Map();
  private currentConfig: Partial<Command> = {};

  constructor(config: ExecutionEngineConfig = {}) {
    this.config = this.validateConfig(config);
    this.initializeAdapters();
  }

  private validateConfig(config: ExecutionEngineConfig): ExecutionEngineConfig {
    const validatedConfig = { ...config };
    
    // Validate timeout
    if (config.defaultTimeout !== undefined && config.defaultTimeout < 0) {
      throw new Error(`Invalid timeout value: ${config.defaultTimeout}`);
    }
    
    // Validate encoding
    if (config.encoding !== undefined) {
      const validEncodings: BufferEncoding[] = ['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex'];
      if (!validEncodings.includes(config.encoding)) {
        throw new Error(`Unsupported encoding: ${config.encoding}`);
      }
    }
    
    // Set defaults
    validatedConfig.defaultTimeout = config.defaultTimeout ?? 30000;
    validatedConfig.throwOnNonZeroExit = config.throwOnNonZeroExit ?? false;
    validatedConfig.encoding = config.encoding ?? 'utf8';
    validatedConfig.maxBuffer = config.maxBuffer ?? 10 * 1024 * 1024;
    
    return validatedConfig;
  }

  private initializeAdapters(): void {
    // Initialize local adapter (always available)
    const localConfig = {
      ...this.getBaseAdapterConfig(),
      ...this.config.adapters?.local,
      preferBun: this.config.runtime?.preferBun
    };
    this.adapters.set('local', new LocalAdapter(localConfig));

    // Initialize SSH adapter if config provided
    if (this.config.adapters?.ssh) {
      const sshConfig = {
        ...this.getBaseAdapterConfig(),
        ...this.config.adapters.ssh
      };
      this.adapters.set('ssh', new SSHAdapter(sshConfig));
    }

    // Initialize Docker adapter if config provided
    if (this.config.adapters?.docker) {
      const dockerConfig = {
        ...this.getBaseAdapterConfig(),
        ...this.config.adapters.docker
      };
      this.adapters.set('docker', new DockerAdapter(dockerConfig));
    }
  }

  private getBaseAdapterConfig() {
    return {
      defaultTimeout: this.config.defaultTimeout,
      defaultCwd: this.config.defaultCwd,
      defaultEnv: this.config.defaultEnv,
      defaultShell: this.config.defaultShell,
      encoding: this.config.encoding,
      maxBuffer: this.config.maxBuffer,
      throwOnNonZeroExit: this.config.throwOnNonZeroExit
    };
  }

  // Main execution method
  async execute(command: Command): Promise<ExecutionResult> {
    const mergedCommand = { ...this.currentConfig, ...command };
    const adapter = await this.selectAdapter(mergedCommand);
    
    if (!adapter) {
      throw new AdapterError('unknown', 'execute', new Error('No suitable adapter found'));
    }

    return adapter.execute(mergedCommand);
  }

  // Template literal support
  async run(strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult> {
    const command = interpolate(strings, ...values);
    return this.execute({ 
      command,
      shell: true
    });
  }

  // Alias for template literal support (for compatibility)
  async tag(strings: TemplateStringsArray, ...values: any[]): Promise<ExecutionResult> {
    return this.run(strings, ...values);
  }

  // Create a process promise for advanced usage
  createProcessPromise(command: Command): ProcessPromise {
    const { readable: stdout, writable: stdoutWrite } = new TransformStream();
    const { readable: stderr, writable: stderrWrite } = new TransformStream();
    const { readable: stdinRead, writable: stdin } = new TransformStream();

    const currentCommand = { ...command };
    let isQuiet = false;
    let noThrow = false;

    const executeCommand = async (): Promise<ExecutionResult> => {
      currentCommand.stdin = stdinRead as any;
      currentCommand.stdout = isQuiet ? 'ignore' : 'pipe';
      currentCommand.stderr = isQuiet ? 'ignore' : 'pipe';

      try {
        const result = await this.execute(currentCommand);
        
        if (!isQuiet) {
          // Write results to streams
          const encoder = new TextEncoder();
          const stdoutWriter = stdoutWrite.getWriter();
          const stderrWriter = stderrWrite.getWriter();
          
          await stdoutWriter.write(encoder.encode(result.stdout));
          await stderrWriter.write(encoder.encode(result.stderr));
          
          await stdoutWriter.close();
          await stderrWriter.close();
        }

        return result;
      } catch (error) {
        if (noThrow) {
          // Return error as result
          return {
            stdout: '',
            stderr: error instanceof Error ? error.message : String(error),
            exitCode: 1,
            signal: undefined,
            command: currentCommand.command,
            duration: 0,
            startedAt: new Date(),
            finishedAt: new Date(),
            adapter: 'unknown'
          } as ExecutionResult;
        }
        throw error;
      }
    };

    const promise = executeCommand() as ProcessPromise;

    // Add stream properties
    promise.stdout = stdout as any;
    promise.stderr = stderr as any;
    promise.stdin = stdin as any;

    // Add method chaining
    promise.pipe = (target: ProcessPromise | ExecutionEngine | NodeJS.WritableStream | TemplateStringsArray, ...args: any[]): ProcessPromise => {
      if (target instanceof ExecutionEngine) {
        return this.createProcessPromise({
          ...currentCommand,
          stdin: stdout as any
        });
      }
      
      if (Array.isArray(target)) {
        // Handle template strings (piping to new command)
        // Build command string from array parts
        let command = '';
        for (let i = 0; i < target.length; i++) {
          command += target[i];
          if (i < args.length) {
            command += String(args[i]);
          }
        }
        return this.createProcessPromise({
          command,
          shell: true,
          stdin: stdout as any
        });
      }
      
      if (target && typeof (target as any).write === 'function') {
        // Pipe to writable stream
        promise.stdout.pipe(target as NodeJS.WritableStream);
        return promise;
      }
      
      // For ProcessPromise targets, would need to implement proper piping
      throw new Error('Piping to ProcessPromise not yet implemented');
    };

    promise.signal = (signal: AbortSignal): ProcessPromise => {
      currentCommand.signal = signal;
      return promise;
    };

    promise.timeout = (ms: number, timeoutSignal?: string): ProcessPromise => {
      currentCommand.timeout = ms;
      if (timeoutSignal) {
        currentCommand.timeoutSignal = timeoutSignal;
      }
      return promise;
    };

    promise.quiet = (): ProcessPromise => {
      isQuiet = true;
      return promise;
    };

    promise.nothrow = (): ProcessPromise => {
      noThrow = true;
      return promise;
    };

    promise.interactive = (): ProcessPromise => {
      currentCommand.stdout = 'inherit';
      currentCommand.stderr = 'inherit';
      currentCommand.stdin = process.stdin as any;
      return promise;
    };

    // Add zx-compatible methods
    promise.text = async (): Promise<string> => {
      const result = await promise;
      return result.stdout.trim();
    };

    promise.json = async <T = any>(): Promise<T> => {
      const text = await promise.text();
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}\nOutput: ${text}`);
      }
    };

    promise.lines = async (): Promise<string[]> => {
      const result = await promise;
      return result.stdout.split('\n').filter(line => line.length > 0);
    };

    promise.buffer = async (): Promise<Buffer> => {
      const result = await promise;
      return Buffer.from(result.stdout);
    };

    promise.kill = (signal = 'SIGTERM'): void => {
      if (currentCommand.signal && typeof currentCommand.signal.dispatchEvent === 'function') {
        // Trigger abort event on the signal
        const event = new Event('abort');
        currentCommand.signal.dispatchEvent(event);
      }
      // Additional kill logic would depend on the adapter implementation
    };

    // Add process-related properties
    promise.child = undefined; // Will be set by adapter if available
    
    Object.defineProperty(promise, 'exitCode', {
      get: () => promise.then(result => result.exitCode)
    });

    return promise;
  }

  // Adapter selection
  private async selectAdapter(command: Command): Promise<BaseAdapter | null> {
    // Explicit adapter selection
    if (command.adapter && command.adapter !== 'auto') {
      const adapter = this.adapters.get(command.adapter);
      if (!adapter) {
        throw new AdapterError(command.adapter, 'select', new Error(`Adapter '${command.adapter}' not configured`));
      }
      return adapter;
    }

    // Auto-detect based on adapter options
    if (command.adapterOptions) {
      switch (command.adapterOptions.type) {
        case 'ssh':
          return this.adapters.get('ssh') || null;
        case 'docker':
          return this.adapters.get('docker') || null;
        case 'local':
          return this.adapters.get('local') || null;
      }
    }

    // Default to local
    return this.adapters.get('local') || null;
  }

  // Configuration methods
  with(config: Partial<Command> & { defaultEnv?: Record<string, string>; defaultCwd?: string }): ExecutionEngine {
    // Extract default* properties from command config
    const { defaultEnv, defaultCwd, ...commandConfig } = config;
    
    // Create new config if defaults are provided
    const engineConfig = (defaultEnv !== undefined || defaultCwd !== undefined) ? {
      ...this.config,
      defaultEnv: defaultEnv ?? this.config.defaultEnv,
      defaultCwd: defaultCwd ?? this.config.defaultCwd
    } : this.config;
    
    // Create new engine with potentially updated config
    const newEngine = new ExecutionEngine(engineConfig);
    newEngine.currentConfig = { ...this.currentConfig, ...commandConfig };
    newEngine.adapters = this.adapters; // Share adapter instances
    return newEngine;
  }

  ssh(options: Omit<SSHAdapterOptions, 'type'>): ExecutionEngine {
    return this.with({
      adapter: 'ssh',
      adapterOptions: { type: 'ssh', ...options }
    });
  }

  docker(options: Omit<DockerAdapterOptions, 'type'>): ExecutionEngine {
    return this.with({
      adapter: 'docker',
      adapterOptions: { type: 'docker', ...options }
    });
  }

  local(): ExecutionEngine {
    return this.with({
      adapter: 'local',
      adapterOptions: { type: 'local' }
    });
  }

  cd(dir: string): ExecutionEngine {
    return this.with({ cwd: dir });
  }

  env(env: Record<string, string>): ExecutionEngine {
    return this.with({ 
      env: { ...this.currentConfig.env, ...env }
    });
  }

  timeout(ms: number): ExecutionEngine {
    return this.with({ timeout: ms });
  }

  shell(shell: string | boolean): ExecutionEngine {
    return this.with({ shell });
  }

  // Utility methods
  async which(command: string): Promise<string | null> {
    try {
      const result = await this.run`which ${command}`;
      const path = result.stdout.trim();
      // If which returns empty output or non-zero exit, command not found
      return (path && result.exitCode === 0) ? path : null;
    } catch {
      return null;
    }
  }

  async isCommandAvailable(command: string): Promise<boolean> {
    const path = await this.which(command);
    return path !== null;
  }

  // Cleanup
  async dispose(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      if ('dispose' in adapter && typeof adapter.dispose === 'function') {
        await adapter.dispose();
      }
    }
  }

  // Get adapter for advanced usage
  getAdapter(name: string): BaseAdapter | undefined {
    return this.adapters.get(name);
  }

  // Register custom adapter
  registerAdapter(name: string, adapter: BaseAdapter): void {
    this.adapters.set(name, adapter);
  }

}