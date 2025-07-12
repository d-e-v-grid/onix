/**
 * xs-compatible shell implementation for uxec
 * Provides full compatibility with zx/xs API
 */

import { ChildProcess } from 'child_process';
import { Readable, Writable } from 'stream';
import { ExecutionEngine, ExecutionEngineConfig } from '../core/execution-engine.js';
import { Command } from '../core/command.js';
import { ProcessOutput, ProcessOutputOptions } from '../core/process-output.js';
import { ExecutionResult } from '../core/result.js';
import { LocalAdapter } from '../adapters/local-adapter.js';
import { SSHAdapter, SSHAdapterConfig } from '../adapters/ssh-adapter.js';
import { DockerAdapter, DockerAdapterConfig } from '../adapters/docker-adapter.js';
import { interpolate, interpolateWithQuote, quote } from '../utils/shell-escape.js';

export interface XsOptions {
  shell?: string | boolean;
  prefix?: string;
  postfix?: string;
  quote?: typeof quote;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  timeoutSignal?: NodeJS.Signals;
  ac?: AbortController;
  signal?: AbortSignal;
  spawn?: any;
  spawnSync?: any;
  log?: any;
  delimiter?: string | RegExp;
  nothrow?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  preferLocal?: boolean | string | string[];
  detached?: boolean;
  windowsHide?: boolean;
  stdio?: 'pipe' | 'inherit' | 'ignore' | Array<'pipe' | 'inherit' | 'ignore'>;
  store?: any;
  sync?: boolean;
  halt?: boolean;
  input?: string | Buffer | Readable | ProcessOutput | XsProcessPromise;
  kill?: any;
  killSignal?: NodeJS.Signals;
}

export interface XsProcessPromise extends Promise<ProcessOutput> {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  exitCode: Promise<number>;
  cmd: Promise<string> | string;
  pipe: {
    stdout: (pieces: TemplateStringsArray, ...args: any[]) => XsProcessPromise;
    stderr: (pieces: TemplateStringsArray, ...args: any[]) => XsProcessPromise;
    stdall: (pieces: TemplateStringsArray, ...args: any[]) => XsProcessPromise;
  } & ((dest: NodeJS.WritableStream | TemplateStringsArray | XsProcessPromise, ...args: any[]) => XsProcessPromise);
  kill(signal?: NodeJS.Signals): Promise<void>;
  nothrow(): XsProcessPromise;
  quiet(): XsProcessPromise;
  verbose(): XsProcessPromise;
  timeout(ms: number, signal?: NodeJS.Signals): XsProcessPromise;
  halt(): XsProcessPromise;
}

class XsProcessPromiseImpl implements XsProcessPromise {
  private _stdin: Writable;
  private _stdout: Readable;
  private _stderr: Readable;
  private _exitCode: Promise<number>;
  private _cmd: Promise<string>;
  private _resolvedCmd?: string;
  private _promise: Promise<ProcessOutput>;
  private _nothrow: boolean = false;
  private _quiet: boolean = false;
  private _verbose: boolean = false;
  private _timeout?: number;
  private _timeoutSignal?: NodeJS.Signals;
  private _halted: boolean = false;
  private _command: string;
  private _adapter: LocalAdapter | SSHAdapter | DockerAdapter;
  private _options: XsOptions;
  private _hasPromiseArgs: boolean = false;

  constructor(
    command: string,
    adapter: LocalAdapter | SSHAdapter | DockerAdapter,
    options: XsOptions,
    pieces?: TemplateStringsArray,
    args?: any[]
  ) {
    this._command = command;
    this._adapter = adapter;
    this._options = options;
    
    // Initialize streams
    this._stdin = new Writable({
      write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        // Basic implementation - just call callback
        callback();
      }
    });
    this._stdout = new Readable({ read() {} });
    this._stderr = new Readable({ read() {} });
    
    // Create cmd Promise that resolves Promise arguments
    if (pieces && args) {
      // Check if any args are Promises
      this._hasPromiseArgs = args.some(arg => arg && typeof arg.then === 'function');
      
      if (this._hasPromiseArgs) {
        this._cmd = this._resolveCommand(pieces, args);
      } else {
        // No promises, resolve immediately
        this._resolvedCmd = command;
        this._cmd = Promise.resolve(command);
      }
    } else {
      this._resolvedCmd = command;
      this._cmd = Promise.resolve(command);
    }
    
    // Lazy execution - will be triggered on first await/then
    this._promise = null as any;
    this._exitCode = null as any;
  }

  private async _resolveCommand(pieces: TemplateStringsArray, args: any[]): Promise<string> {
    // Resolve any Promise arguments
    const resolvedArgs = await Promise.all(
      args.map(async (arg) => {
        if (arg && typeof arg.then === 'function') {
          try {
            const result = await arg;
            // If result is ProcessOutput, use its stdout
            if (result && typeof result === 'object' && 'stdout' in result) {
              return result.stdout.trim();
            }
            return result;
          } catch {
            // If Promise rejects, return empty string
            return '';
          }
        }
        return arg;
      })
    );
    
    // Now interpolate with resolved values, using the custom quote function if provided
    const resolved = interpolateWithQuote(pieces, this._options.quote, ...resolvedArgs);
    this._resolvedCmd = resolved;
    return resolved;
  }

  private _ensureStarted() {
    if (!this._promise) {
      this._promise = this._execute();
      this._exitCode = this._promise.then(output => output.exitCode ?? 0);
    }
  }

  private async _execute(): Promise<ProcessOutput> {
    // Wait for the command to be resolved
    const baseCommand = await this._cmd;
    
    // Apply prefix and postfix
    let resolvedCommand = baseCommand;
    if (this._options.prefix && this._options.shell) {
      resolvedCommand = this._options.prefix + ' ' + resolvedCommand;
    }
    if (this._options.postfix && this._options.shell) {
      resolvedCommand = resolvedCommand + ' ' + this._options.postfix;
    }
    
    // Ensure _resolvedCmd is set
    this._resolvedCmd = resolvedCommand;
    
    if (this._halted) {
      return new ProcessOutput({
        stdout: '',
        stderr: '',
        exitCode: 0,
        signal: null,
        duration: 0,
        command: resolvedCommand,
        cwd: this._options.cwd,
      });
    }

    // Handle input from piping
    let stdin: string | undefined;
    if (this._options.input) {
      if (typeof this._options.input === 'string') {
        stdin = this._options.input;
      } else if (this._options.input instanceof Promise) {
        try {
          const result = await this._options.input;
          stdin = typeof result === 'string' ? result : result.stdout;
        } catch {
          stdin = undefined;
        }
      }
    }

    const cmd: Command = {
      command: resolvedCommand,
      args: [],
      shell: this._options.shell,
      cwd: this._options.cwd,
      env: this._options.env as Record<string, string>,
      timeout: this._timeout || this._options.timeout,
      timeoutSignal: this._timeoutSignal || this._options.timeoutSignal,
      signal: this._options.signal,
      stdin: stdin,
    };

    if ((this._verbose || this._options.verbose) && !this._quiet && !this._options.quiet) {
      console.log(`$ ${resolvedCommand}`);
    }

    try {
      const result = await this._adapter.execute(cmd);
      const output = new ProcessOutput({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        signal: result.signal as NodeJS.Signals | null | undefined,
        duration: result.duration,
        command: resolvedCommand,
        cwd: this._options.cwd,
      });
      
      if (result.exitCode !== 0 && !this._nothrow && !this._options.nothrow) {
        throw output;
      }
      
      return output;
    } catch (error: any) {
      const output = new ProcessOutput({
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.exitCode ?? 1,
        signal: error.signal,
        duration: error.duration || 0,
        command: resolvedCommand,
        cwd: this._options.cwd,
      });
      
      if (!this._nothrow && !this._options.nothrow) {
        throw output;
      }
      
      return output;
    }
  }

  get stdin(): Writable { 
    this._ensureStarted();
    return this._stdin; 
  }
  get stdout(): Readable { 
    this._ensureStarted();
    return this._stdout; 
  }
  get stderr(): Readable { 
    this._ensureStarted();
    return this._stderr; 
  }
  get exitCode(): Promise<number> { 
    this._ensureStarted();
    return this._exitCode; 
  }
  get cmd(): Promise<string> | string {
    // If we have resolved the command, return the string
    if (this._resolvedCmd !== undefined) {
      return this._resolvedCmd;
    }
    // If we don't have promise args, the command is already resolved
    if (!this._hasPromiseArgs) {
      return this._command;
    }
    // Otherwise return the promise
    return this._cmd;
  }


  async kill(signal?: NodeJS.Signals): Promise<void> {
    // TODO: Implement kill functionality
  }

  // Special pipe object with stderr, stdout, stdall methods
  get pipe(): {
    stdout: (pieces: TemplateStringsArray, ...args: any[]) => XsProcessPromise;
    stderr: (pieces: TemplateStringsArray, ...args: any[]) => XsProcessPromise;
    stdall: (pieces: TemplateStringsArray, ...args: any[]) => XsProcessPromise;
  } & ((dest: NodeJS.WritableStream | TemplateStringsArray | XsProcessPromise, ...args: any[]) => XsProcessPromise) {
    const self = this;
    
    const pipeFunction = (dest: NodeJS.WritableStream | TemplateStringsArray | XsProcessPromise, ...args: any[]): XsProcessPromise => {
      // Check if dest is an XsProcessPromise
      if (dest && typeof (dest as any).then === 'function' && 'pipe' in dest) {
        // It's an XsProcessPromise - wait for cmd to resolve then create new promise
        const destPromise = dest as XsProcessPromise;
        
        // Create a placeholder promise that will be resolved with the piped command
        const newPromise = new XsProcessPromiseImpl('', self._adapter, self._options);
        
        // Override the execute method to pipe from source to dest
        newPromise._execute = async function(): Promise<ProcessOutput> {
          try {
            // Execute source command first
            self._ensureStarted();
            const sourceOutput = await self._promise;
            
            // Get the destination command
            const destCmd = await destPromise.cmd;
            
            // Create and execute the piped command with source stdout as input
            const pipedPromise = new XsProcessPromiseImpl(destCmd, self._adapter, {
              ...self._options,
              input: sourceOutput.stdout
            });
            
            return await pipedPromise;
          } catch (error: any) {
            // Re-throw as ProcessOutput if needed
            if (error instanceof ProcessOutput) {
              throw error;
            }
            throw new ProcessOutput({
              stdout: '',
              stderr: error?.message || String(error),
              exitCode: 1,
              signal: null,
              duration: 0,
              command: '',
              cwd: self._options.cwd,
            });
          }
        };
        
        return newPromise;
      } else if (Array.isArray(dest)) {
        // Pipe to another command via template literal
        const command = interpolateWithQuote(dest as TemplateStringsArray, self._options.quote, ...args);
        
        // Create new promise that pipes output
        const newPromise = new XsProcessPromiseImpl(command, self._adapter, {
          ...self._options,
          input: self
        });
        
        return newPromise;
      }
      // Pipe to stream
      self._ensureStarted();
      const newPromise = new XsProcessPromiseImpl('', self._adapter, self._options);
      
      // Override execute to write to stream and return self
      newPromise._execute = async function(): Promise<ProcessOutput> {
        const output = await self._promise;
        // Write output to destination stream
        if ('write' in dest && typeof dest.write === 'function') {
          dest.write(output.stdout);
        }
        return output;
      };
      
      return newPromise;
    };
    
    // Add methods to the function
    Object.assign(pipeFunction, {
      stdout: (pieces: TemplateStringsArray, ...args: any[]) => {
        const command = interpolateWithQuote(pieces, self._options.quote, ...args);
        
        // Create new promise that will pipe stdout
        const newPromise = new XsProcessPromiseImpl(command, self._adapter, self._options);
        
        // Override execute to use stdout as input
        newPromise._execute = async function(): Promise<ProcessOutput> {
          self._ensureStarted();
          const output = await self._promise;
          const pipedPromise = new XsProcessPromiseImpl(command, self._adapter, {
            ...self._options,
            input: output.stdout
          });
          return await pipedPromise;
        };
        
        return newPromise;
      },
      
      stderr: (pieces: TemplateStringsArray, ...args: any[]) => {
        const command = interpolateWithQuote(pieces, self._options.quote, ...args);
        
        // Create new promise that will pipe stderr
        const newPromise = new XsProcessPromiseImpl(command, self._adapter, self._options);
        
        // Override execute to use stderr as input
        newPromise._execute = async function(): Promise<ProcessOutput> {
          self._ensureStarted();
          const output = await self._promise;
          const pipedPromise = new XsProcessPromiseImpl(command, self._adapter, {
            ...self._options,
            input: output.stderr
          });
          return await pipedPromise;
        };
        
        return newPromise;
      },
      
      stdall: (pieces: TemplateStringsArray, ...args: any[]) => {
        const command = interpolateWithQuote(pieces, self._options.quote, ...args);
        
        // Create new promise that will pipe stdall
        const newPromise = new XsProcessPromiseImpl(command, self._adapter, self._options);
        
        // Override execute to use stdall as input
        newPromise._execute = async function(): Promise<ProcessOutput> {
          self._ensureStarted();
          const output = await self._promise;
          const pipedPromise = new XsProcessPromiseImpl(command, self._adapter, {
            ...self._options,
            input: output.stdall || (output.stdout + output.stderr)
          });
          return await pipedPromise;
        };
        
        return newPromise;
      }
    });
    
    return pipeFunction as any;
  }

  nothrow(): XsProcessPromise {
    // Create a new instance with nothrow enabled
    const newPromise = new XsProcessPromiseImpl(this._command, this._adapter, {
      ...this._options,
      nothrow: true
    });
    newPromise._nothrow = true;
    return newPromise;
  }

  quiet(): XsProcessPromise {
    // Create a new instance with quiet enabled
    const newPromise = new XsProcessPromiseImpl(this._command, this._adapter, {
      ...this._options,
      quiet: true
    });
    newPromise._quiet = true;
    return newPromise;
  }

  verbose(): XsProcessPromise {
    // Create a new instance with verbose enabled
    const newPromise = new XsProcessPromiseImpl(this._command, this._adapter, {
      ...this._options,
      verbose: true
    });
    newPromise._verbose = true;
    return newPromise;
  }

  timeout(ms: number, signal?: NodeJS.Signals): XsProcessPromise {
    this._timeout = ms;
    this._timeoutSignal = signal;
    return this;
  }

  halt(): XsProcessPromise {
    this._halted = true;
    return this;
  }

  then<TResult1 = ProcessOutput, TResult2 = never>(
    onfulfilled?: ((value: ProcessOutput) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    this._ensureStarted();
    return this._promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<ProcessOutput | TResult> {
    this._ensureStarted();
    return this._promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<ProcessOutput> {
    this._ensureStarted();
    return this._promise.finally(onfinally);
  }

  get [Symbol.toStringTag]() {
    return 'XsProcessPromise';
  }
}

/**
 * Create xs-compatible $ function
 */
export function createXsShell(options: XsOptions = {}): any {
  const config: ExecutionEngineConfig = {
    defaultCwd: options.cwd,
    defaultEnv: options.env as Record<string, string>,
    defaultShell: options.shell,
    defaultTimeout: options.timeout,
    throwOnNonZeroExit: !options.nothrow,
  };

  const engine = new ExecutionEngine(config);
  const localAdapter = new LocalAdapter();

  // Main $ function
  const $ = (pieces: TemplateStringsArray, ...args: any[]): XsProcessPromise => {
    const command = interpolateWithQuote(pieces, options.quote, ...args);
    return new XsProcessPromiseImpl(command, localAdapter, options, pieces, args);
  };

  // Configuration function
  const configure = (newOptions: XsOptions) => {
    return createXsShell({ ...options, ...newOptions });
  };

  // Handle $(options) syntax
  const $proxy = new Proxy($, {
    apply(target, thisArg, args) {
      if (args.length === 1 && !Array.isArray(args[0]) && typeof args[0] === 'object') {
        return configure(args[0] as XsOptions);
      }
      return target.apply(thisArg, args);
    },
    get(target, prop) {
      // Return property value if it exists
      if (prop in target) {
        return (target as any)[prop];
      }
      
      // Return options properties
      if (prop === 'sync') return $sync;
      
      switch(prop) {
        case 'verbose': return options.verbose || false;
        case 'quiet': return options.quiet || false;
        case 'shell': return options.shell !== false ? (options.shell || true) : false;
        case 'cwd': return options.cwd || process.cwd();
        case 'env': return options.env || process.env;
        case 'prefix': return options.prefix !== undefined ? options.prefix : 'set -euo pipefail;';
        case 'postfix': return options.postfix !== undefined ? options.postfix : '';
        case 'quote': return options.quote || quote;
        case 'spawn': return options.spawn;
        case 'log': return options.log;
        case 'ssh': return createSSHShell;
        case 'docker': return createDockerShell;
      }
      
      return undefined;
    },
    set(target, prop, value) {
      // Allow setting any property
      (target as any)[prop] = value;
      // Update options for known properties
      if (prop === 'cwd' || prop === 'env' || prop === 'verbose' || prop === 'quiet' || 
          prop === 'shell' || prop === 'prefix' || prop === 'postfix' || prop === 'quote' ||
          prop === 'spawn' || prop === 'log' || prop === 'nothrow' || prop === 'preferLocal' ||
          prop === 'timeout' || prop === 'timeoutSignal' || prop === 'ac' || prop === 'signal' ||
          prop === 'delimiter' || prop === 'detached' || prop === 'windowsHide' || prop === 'stdio' ||
          prop === 'store' || prop === 'sync' || prop === 'halt' || prop === 'input') {
        (options as any)[prop] = value;
      }
      return true;
    }
  });

  // Sync execution
  const $syncFn = (pieces: TemplateStringsArray, ...args: any[]): ProcessOutput => {
    const command = interpolateWithQuote(pieces, options.quote, ...args);
    
    if (options.verbose && !options.quiet) {
      console.log(`$ ${command}`);
    }

    const cmd: Command = {
      command,
      args: [],
      shell: options.shell,
      cwd: options.cwd,
      env: options.env as Record<string, string>,
    };

    try {
      const result = localAdapter.executeSync(cmd);
      return new ProcessOutput({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        signal: result.signal as NodeJS.Signals | null | undefined,
        duration: result.duration,
        command,
        cwd: options.cwd,
      });
    } catch (error: any) {
      const output = new ProcessOutput({
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.exitCode ?? 1,
        signal: error.signal,
        duration: error.duration || 0,
        command,
        cwd: options.cwd,
      });
      
      if (!options.nothrow) {
        throw output;
      }
      
      return output;
    }
  };

  // Add ability to call $.sync(options)
  const $sync = Object.assign($syncFn, (opts: Partial<XsOptions>): any => {
    return createXsShell({ ...options, ...opts, sync: true });
  });

  // SSH shell creation
  const createSSHShell = (config: SSHAdapterConfig) => {
    const sshAdapter = new SSHAdapter(config);
    return async (pieces: TemplateStringsArray, ...args: any[]): Promise<ProcessOutput> => {
      const command = interpolateWithQuote(pieces, options.quote, ...args);
      return new XsProcessPromiseImpl(command, sshAdapter, options);
    };
  };

  // Docker shell creation
  const createDockerShell = (config: DockerAdapterConfig) => {
    const dockerAdapter = new DockerAdapter(config);
    return async (pieces: TemplateStringsArray, ...args: any[]): Promise<ProcessOutput> => {
      const command = interpolateWithQuote(pieces, options.quote, ...args);
      return new XsProcessPromiseImpl(command, dockerAdapter, options);
    };
  };

  // Assign all default options to the proxy to match xs/zx Options interface
  // First assign all options
  Object.assign($proxy, {
    verbose: options.verbose || false,
    quiet: options.quiet || false,
    shell: options.shell !== false ? (options.shell || true) : false,
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    prefix: options.prefix !== undefined ? options.prefix : 'set -euo pipefail;',
    postfix: options.postfix !== undefined ? options.postfix : '',
    quote: options.quote || quote,
    spawn: options.spawn,
    spawnSync: options.spawnSync,
    log: options.log,
    stdio: options.stdio || 'pipe',
    nothrow: options.nothrow || false,
    detached: options.detached || false,
    preferLocal: options.preferLocal || false,
    timeout: options.timeout,
    timeoutSignal: options.timeoutSignal,
    ac: options.ac,
    signal: options.signal,
    store: options.store,
    halt: options.halt,
    delimiter: options.delimiter,
    input: options.input,
    kill: options.kill,
    killSignal: options.killSignal,
  });
  
  // Then override sync with the function
  Object.defineProperty($proxy, 'sync', {
    value: $sync,
    writable: true,
    enumerable: true,
    configurable: true
  });

  return $proxy;
}

// Alias for backward compatibility
export const createXsCompatibleShell = createXsShell;