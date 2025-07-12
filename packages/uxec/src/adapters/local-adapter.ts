import { platform } from 'node:os';
import { Readable } from 'node:stream';
import { spawn, spawnSync } from 'node:child_process';

import { Command } from '../core/command.js';
import { ExecutionResult } from '../core/result.js';
import { StreamHandler } from '../core/stream-handler.js';
import { RuntimeDetector } from '../utils/runtime-detect.js';
import { CommandError, AdapterError } from '../core/error.js';
import { BaseAdapter, BaseAdapterConfig } from './base-adapter.js';

export interface LocalAdapterConfig extends BaseAdapterConfig {
  preferBun?: boolean;
  forceImplementation?: 'node' | 'bun';
  uid?: number;
  gid?: number;
  killSignal?: string;
}

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
}

export class LocalAdapter extends BaseAdapter {
  protected readonly adapterName = 'local';
  private localConfig: LocalAdapterConfig;

  constructor(config: LocalAdapterConfig = {}) {
    super(config);
    this.localConfig = config;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Local execution is always available
  }

  async execute(command: Command): Promise<ExecutionResult> {
    const mergedCommand = this.mergeCommand(command);
    const startTime = Date.now();

    try {
      const implementation = this.getImplementation();
      
      let result: ProcessResult;
      if (implementation === 'bun' && RuntimeDetector.isBun()) {
        result = await this.executeBun(mergedCommand);
      } else {
        result = await this.executeNode(mergedCommand);
      }

      const endTime = Date.now();
      
      return this.createResult(
        result.stdout,
        result.stderr,
        result.exitCode ?? 0,
        result.signal ?? undefined,
        this.buildCommandString(mergedCommand),
        startTime,
        endTime
      );
    } catch (error) {
      if (error instanceof CommandError || error instanceof AdapterError) {
        throw error;
      }
      
      throw new AdapterError(
        this.adapterName, 
        'execute', 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  override executeSync(command: Command): ExecutionResult {
    const mergedCommand = this.mergeCommand(command);
    const startTime = Date.now();

    try {
      const implementation = this.getImplementation();
      
      let result: ProcessResult;
      if (implementation === 'bun' && RuntimeDetector.isBun()) {
        result = this.executeBunSync(mergedCommand);
      } else {
        result = this.executeNodeSync(mergedCommand);
      }

      const endTime = Date.now();
      
      return this.createResult(
        result.stdout,
        result.stderr,
        result.exitCode ?? 0,
        result.signal ?? undefined,
        this.buildCommandString(mergedCommand),
        startTime,
        endTime
      );
    } catch (error) {
      if (error instanceof CommandError || error instanceof AdapterError) {
        throw error;
      }
      
      throw new AdapterError(
        this.adapterName, 
        'executeSync', 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private getImplementation(): 'node' | 'bun' {
    if (this.localConfig.forceImplementation) {
      return this.localConfig.forceImplementation;
    }

    if (this.localConfig.preferBun && RuntimeDetector.isBun()) {
      return 'bun';
    }

    return 'node';
  }

  private async executeNode(command: Command): Promise<ProcessResult> {
    const stdoutHandler = new StreamHandler({
      encoding: this.config.encoding,
      maxBuffer: this.config.maxBuffer
    });
    
    const stderrHandler = new StreamHandler({
      encoding: this.config.encoding,
      maxBuffer: this.config.maxBuffer
    });

    const spawnOptions = this.buildNodeSpawnOptions(command);
    const child = spawn(command.command, command.args || [], spawnOptions);

    // Handle stdin
    if (command.stdin) {
      if (typeof command.stdin === 'string' || Buffer.isBuffer(command.stdin)) {
        child.stdin?.write(command.stdin);
        child.stdin?.end();
      } else if (command.stdin instanceof Readable) {
        command.stdin.pipe(child.stdin!);
      }
    }

    // Handle abort signal
    if (command.signal) {
      const cleanup = () => child.kill(this.localConfig.killSignal as any);
      await this.handleAbortSignal(command.signal, cleanup);
    }

    // Collect output
    if (child.stdout && command.stdout === 'pipe') {
      child.stdout.pipe(stdoutHandler.createTransform());
    }
    
    if (child.stderr && command.stderr === 'pipe') {
      child.stderr.pipe(stderrHandler.createTransform());
    }

    // Wait for process completion
    const processPromise = new Promise<ProcessResult>((resolve, reject) => {
      child.on('error', (err: any) => {
        // Enhance error message for common cases
        if (err.code === 'ENOENT') {
          if (err.syscall === 'spawn /bin/sh' || err.syscall === 'spawn') {
            // Check if it's likely a cwd issue
            if (command.cwd) {
              err.message = `spawn ${err.path || '/bin/sh'} ENOENT: No such file or directory (cwd: ${command.cwd})`;
            } else {
              err.message = `spawn ${err.path || '/bin/sh'} ENOENT: No such file or directory`;
            }
          }
        }
        reject(err);
      });
      
      child.on('exit', (code, signal) => {
        resolve({
          stdout: stdoutHandler.getContent(),
          stderr: stderrHandler.getContent(),
          exitCode: code,
          signal
        });
      });
    });

    // Handle timeout
    const timeout = command.timeout ?? this.config.defaultTimeout;
    const result = await this.handleTimeout(
      processPromise,
      timeout,
      this.buildCommandString(command),
      () => child.kill(this.localConfig.killSignal as any)
    );

    return result;
  }

  private async executeBun(command: Command): Promise<ProcessResult> {
    // @ts-ignore - Bun global
    const Bun = globalThis.Bun;
    if (!Bun || !Bun.spawn) {
      throw new AdapterError(this.adapterName, 'execute', new Error('Bun.spawn is not available'));
    }

    const stdoutHandler = new StreamHandler({
      encoding: this.config.encoding,
      maxBuffer: this.config.maxBuffer
    });
    
    const stderrHandler = new StreamHandler({
      encoding: this.config.encoding,
      maxBuffer: this.config.maxBuffer
    });

    const proc = Bun.spawn({
      cmd: [command.command, ...(command.args || [])],
      cwd: command.cwd,
      env: this.createCombinedEnv(this.config.defaultEnv, command.env),
      stdin: this.mapBunStdin(command.stdin),
      stdout: command.stdout === 'pipe' ? 'pipe' : command.stdout,
      stderr: command.stderr === 'pipe' ? 'pipe' : command.stderr
    });

    // Handle stdin for string/buffer
    if (command.stdin && (typeof command.stdin === 'string' || Buffer.isBuffer(command.stdin))) {
      const writer = proc.stdin.getWriter();
      await writer.write(typeof command.stdin === 'string' ? new TextEncoder().encode(command.stdin) : command.stdin);
      await writer.close();
    }

    // Collect output
    const stdoutPromise = command.stdout === 'pipe' && proc.stdout 
      ? this.streamBunReadable(proc.stdout, stdoutHandler)
      : Promise.resolve();
      
    const stderrPromise = command.stderr === 'pipe' && proc.stderr
      ? this.streamBunReadable(proc.stderr, stderrHandler)
      : Promise.resolve();

    // Wait for process completion
    const exitPromise = proc.exited;

    // Handle timeout
    const timeout = command.timeout ?? this.config.defaultTimeout;
    const exitCode = await this.handleTimeout(
      exitPromise,
      timeout,
      this.buildCommandString(command),
      () => proc.kill()
    );

    await Promise.all([stdoutPromise, stderrPromise]);

    return {
      stdout: stdoutHandler.getContent(),
      stderr: stderrHandler.getContent(),
      exitCode,
      signal: null
    };
  }

  private buildNodeSpawnOptions(command: Command): any {
    const options: any = {
      cwd: command.cwd,
      env: this.createCombinedEnv(this.config.defaultEnv, command.env),
      detached: command.detached,
      windowsHide: true
    };

    // Check if cwd exists if provided
    if (command.cwd) {
      try {
        require('fs').accessSync(command.cwd, require('fs').constants.F_OK);
      } catch (err) {
        // This will be caught by spawn and result in an ENOENT error
        // Keep cwd as is - spawn will handle the error appropriately
      }
    }

    if (this.localConfig.uid !== undefined) {
      options.uid = this.localConfig.uid;
    }

    if (this.localConfig.gid !== undefined) {
      options.gid = this.localConfig.gid;
    }

    // Handle shell option properly
    if (command.shell === true) {
      if (platform() === 'win32') {
        options.shell = 'cmd.exe';
      } else {
        // For Unix systems, try to find available shell
        const availableShells = ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh'];
        let shellFound = false;
        
        for (const shell of availableShells) {
          try {
            require('fs').accessSync(shell, require('fs').constants.F_OK);
            options.shell = shell;
            shellFound = true;
            break;
          } catch {
            // Shell not found, try next
          }
        }
        
        if (!shellFound) {
          // Fallback to just true and let Node.js decide
          options.shell = true;
        }
      }
    } else if (typeof command.shell === 'string') {
      options.shell = command.shell;
    } else {
      options.shell = command.shell;
    }

    // Handle stdio
    options.stdio = [
      command.stdin ? 'pipe' : 'ignore',
      command.stdout || 'pipe',
      command.stderr || 'pipe'
    ];

    return options;
  }

  private mapBunStdin(stdin: Command['stdin']): any {
    if (!stdin) return 'ignore';
    if (stdin instanceof Readable) return stdin;
    if (typeof stdin === 'string' || Buffer.isBuffer(stdin)) return 'pipe';
    return 'ignore';
  }

  private async streamBunReadable(readable: any, handler: StreamHandler): Promise<void> {
    const reader = readable.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = Buffer.from(value);
        const transform = handler.createTransform();
        
        await new Promise<void>((resolve, reject) => {
          transform.on('error', reject);
          transform.on('finish', resolve);
          transform.write(chunk);
          transform.end();
        });
      }
    } finally {
      reader.releaseLock();
    }
  }

  private executeNodeSync(command: Command): ProcessResult {
    const spawnOptions = this.buildNodeSpawnOptions(command);
    
    // Add encoding for sync execution
    spawnOptions.encoding = this.config.encoding;
    
    const result = spawnSync(command.command, command.args || [], spawnOptions);
    
    return {
      stdout: result.stdout?.toString() || '',
      stderr: result.stderr?.toString() || '',
      exitCode: result.status,
      signal: result.signal
    };
  }

  private executeBunSync(command: Command): ProcessResult {
    // @ts-ignore - Bun global
    const proc = Bun.spawnSync({
      cmd: [command.command, ...(command.args || [])],
      cwd: command.cwd,
      env: this.createCombinedEnv(this.config.defaultEnv, command.env),
      stdin: command.stdin && (typeof command.stdin === 'string' || Buffer.isBuffer(command.stdin))
        ? command.stdin
        : undefined,
      stdout: command.stdout === 'pipe' ? 'pipe' : command.stdout,
      stderr: command.stderr === 'pipe' ? 'pipe' : command.stderr
    });

    return {
      stdout: proc.stdout ? new TextDecoder().decode(proc.stdout) : '',
      stderr: proc.stderr ? new TextDecoder().decode(proc.stderr) : '',
      exitCode: proc.exitCode,
      signal: null
    };
  }
}