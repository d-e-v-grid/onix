// Copyright 2025 Onix Team
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { type ChildProcess } from 'node:child_process'
import { PassThrough, type Readable, type Writable } from 'node:stream'
import {
  SSHAdapter,
  type Command,
  LocalAdapter,
  DockerAdapter,
  ExecutionEngine,
  type ExecutionResult,
  type ExecutionEngineConfig,
} from '@onix-js/uxec'

import { randomId } from './util.js'
import { ProcessOutput } from './core.js'

import type { Shell, Options } from './core.js'

// Interface to bridge between zx ProcessPromise and uxec ProcessPromise
export interface UxecProcessPromise extends Promise<ProcessOutput> {
  _id: string
  _command: string
  _from: string
  _piped: boolean
  _pipedFrom?: UxecProcessPromise
  _stdin: Writable
  _stdout: Readable
  _stderr: Readable
  _ee: EventEmitter
  _output: ProcessOutput | null
  _reject: (out: ProcessOutput) => void
  _resolve: (out: ProcessOutput) => void
  _nothrow?: boolean
  _quiet?: boolean
  _verbose?: boolean
  _timeout?: number
  _timeoutSignal?: NodeJS.Signals
  _timeoutId?: ReturnType<typeof setTimeout>
  _zurk: any
  _uxecPromise?: ReturnType<ExecutionEngine['execute']>
  child?: ChildProcess

  run(): UxecProcessPromise
  pipe(dest: any): any
  kill(signal?: string): void
  nothrow(): UxecProcessPromise
  quiet(): UxecProcessPromise
  verbose(v?: boolean): UxecProcessPromise
  timeout(timeout: number, signal?: NodeJS.Signals): UxecProcessPromise
  halt(): UxecProcessPromise
  get stdin(): Writable
  get stdout(): Readable
  get stderr(): Readable
  get exitCode(): Promise<number | null>
  json<T = any>(): Promise<T>
  text(): Promise<string>
  lines(): Promise<string[]>
  buffer(): Promise<Buffer>
}

// Adapter class to convert ExecutionResult to ProcessOutput
export class ProcessOutputAdapter extends ProcessOutput {
  constructor(result: ExecutionResult, command: string, from: string) {
    const error = result.exitCode !== 0 
      ? Object.assign(new Error(`Command failed: ${command}`), {
          exitCode: result.exitCode,
          signal: result.signal,
          stdout: result.stdout,
          stderr: result.stderr,
        })
      : null

    super({
      code: result.exitCode,
      signal: result.signal || null,
      error,
      duration: result.duration || 0,
      store: {
        stdout: Buffer.from(result.stdout),
        stderr: Buffer.from(result.stderr),
      },
      from,
    })
  }
}

// Create uxec engine with configuration
export function createUxecEngine(options: Options): ExecutionEngine {
  const config: ExecutionEngineConfig = {
    defaultCwd: options.cwd,
    defaultEnv: options.env,
    defaultShell: typeof options.shell === 'string' ? options.shell : undefined,
    defaultTimeout: options.timeout,
    verbose: options.verbose,
    dryRun: false,
    maxBuffer: 200 * 1024 * 1024, // 200MB default
  }

  return new ExecutionEngine(config)
}

// Create a ProcessPromise-like object using uxec
export function createUxecProcessPromise(
  command: string,
  options: Options,
  from: string
): UxecProcessPromise {
  const id = randomId()
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const ee = new EventEmitter()
  
  let output: ProcessOutput | null = null
  let uxecPromise: ReturnType<ExecutionEngine['execute']> | null = null
  let resolveFunc: ((out: ProcessOutput) => void) | null = null
  let rejectFunc: ((out: ProcessOutput) => void) | null = null
  let childProcess: ChildProcess | undefined

  const promise = new Promise<ProcessOutput>((resolve, reject) => {
    resolveFunc = resolve
    rejectFunc = reject
  }) as UxecProcessPromise

  // Add properties
  Object.assign(promise, {
    _id: id,
    _command: command,
    _from: from,
    _piped: false,
    _pipedFrom: undefined,
    _stdin: stdin,
    _stdout: stdout,
    _stderr: stderr,
    _ee: ee,
    _output: null,
    _reject: rejectFunc!,
    _resolve: resolveFunc!,
    _nothrow: false,
    _quiet: options.quiet,
    _verbose: options.verbose,
    _timeout: options.timeout,
    _timeoutSignal: options.timeoutSignal,
    _zurk: null,
    _uxecPromise: null,
    child: undefined,

    run(): UxecProcessPromise {
      if (uxecPromise) return promise // Already running

      const engine = createUxecEngine(options)
      
      // Create command object
      const cmd: Command = {
        command,
        args: [],
        options: {
          cwd: options.cwd,
          env: options.env as Record<string, string>,
          timeout: promise._timeout,
          stdin: promise._stdin,
          stdout: promise._stdout,
          stderr: promise._stderr,
        }
      }

      // Set up logging
      if (promise._verbose && !promise._quiet) {
        console.log(`$ ${command}`)
      }

      // Execute with uxec
      uxecPromise = engine.execute(cmd, new LocalAdapter())
      promise._uxecPromise = uxecPromise

      // Handle stdout/stderr streams
      uxecPromise.then(async (processPromise) => {
        // Get child process if available
        if ('child' in processPromise && processPromise.child) {
          childProcess = processPromise.child as ChildProcess
          promise.child = childProcess
        }

        // Wait for result
        const result = await processPromise
        
        // Create ProcessOutput
        output = new ProcessOutputAdapter(result, command, from)
        promise._output = output

        // Handle success/failure
        if (result.exitCode !== 0 && !promise._nothrow) {
          rejectFunc!(output)
        } else {
          resolveFunc!(output)
        }
      }).catch((error) => {
        // Handle execution errors
        const errorOutput = new ProcessOutput({
          code: error.exitCode ?? 1,
          signal: error.signal ?? null,
          error,
          duration: 0,
          store: {
            stdout: Buffer.from(error.stdout || ''),
            stderr: Buffer.from(error.stderr || error.message),
          },
          from,
        })
        promise._output = errorOutput
        
        if (!promise._nothrow) {
          rejectFunc!(errorOutput)
        } else {
          resolveFunc!(errorOutput)
        }
      })

      return promise
    },

    pipe(dest: any): any {
      promise._piped = true
      
      if (typeof dest === 'string' || Array.isArray(dest)) {
        // Pipe to another command
        const newCommand = Array.isArray(dest) 
          ? dest.join(' ') 
          : dest
        
        const pipedPromise = createUxecProcessPromise(newCommand, options, from)
        pipedPromise._pipedFrom = promise
        
        // Connect streams
        promise._stdout.pipe(pipedPromise._stdin)
        
        return pipedPromise
      } else if (dest && typeof dest.write === 'function') {
        // Pipe to writable stream
        promise._stdout.pipe(dest)
        return promise
      }
      
      return promise
    },

    kill(signal = 'SIGTERM'): void {
      if (childProcess) {
        childProcess.kill(signal)
      }
      promise._timeoutId && clearTimeout(promise._timeoutId)
    },

    nothrow(): UxecProcessPromise {
      promise._nothrow = true
      return promise
    },

    quiet(): UxecProcessPromise {
      promise._quiet = true
      return promise
    },

    verbose(v = true): UxecProcessPromise {
      promise._verbose = v
      return promise
    },

    timeout(timeout: number, signal?: NodeJS.Signals): UxecProcessPromise {
      promise._timeout = timeout
      promise._timeoutSignal = signal
      return promise
    },

    halt(): UxecProcessPromise {
      promise.kill()
      return promise
    },

    get stdin(): Writable {
      return promise._stdin
    },

    get stdout(): Readable {
      return promise._stdout
    },

    get stderr(): Readable {
      return promise._stderr
    },

    get exitCode(): Promise<number | null> {
      return promise.then(output => output.exitCode)
    },

    async json<T = any>(): Promise<T> {
      const output = await promise
      return JSON.parse(output.stdout)
    },

    async text(): Promise<string> {
      const output = await promise
      return output.stdout.trim()
    },

    async lines(): Promise<string[]> {
      const output = await promise
      return output.stdout.split('\n').filter(line => line.length > 0)
    },

    async buffer(): Promise<Buffer> {
      const output = await promise
      return output._stdout
    },
  })

  return promise
}

// Create $ function using uxec
export function createUxecShell(options: Options): Shell {
  const $ = (pieces: TemplateStringsArray, ...args: any[]) => {
    const command = pieces
      .map((piece, i) => piece + (args[i] ?? ''))
      .join('')
      .trim()
    
    const from = new Error().stack?.split('\n')[2] ?? ''
    const promise = createUxecProcessPromise(command, options, from)
    
    return promise.run()
  }

  // Add special methods
  Object.assign($, {
    sync(pieces: TemplateStringsArray, ...args: any[]) {
      // Implement sync execution
      const command = pieces
        .map((piece, i) => piece + (args[i] ?? ''))
        .join('')
        .trim()
      
      const engine = createUxecEngine({ ...options, sync: true } as any)
      const cmd: Command = {
        command,
        args: [],
        options: {
          cwd: options.cwd,
          env: options.env as Record<string, string>,
        }
      }
      
      // Execute synchronously
      const adapter = new LocalAdapter()
      const result = adapter.executeSync(cmd)
      
      return new ProcessOutputAdapter(result, command, '')
    },

    ssh(config: any) {
      // Return a $ function that uses SSH adapter
      return (pieces: TemplateStringsArray, ...args: any[]) => {
        const command = pieces
          .map((piece, i) => piece + (args[i] ?? ''))
          .join('')
          .trim()
        
        const from = new Error().stack?.split('\n')[2] ?? ''
        const engine = createUxecEngine(options)
        const adapter = new SSHAdapter(config)
        
        const cmd: Command = {
          command,
          args: [],
          options: {
            cwd: options.cwd,
            env: options.env as Record<string, string>,
          }
        }
        
        const uxecPromise = engine.execute(cmd, adapter)
        
        // Convert to ProcessPromise-like object
        const promise = uxecPromise.then(async (processPromise) => {
          const result = await processPromise
          return new ProcessOutputAdapter(result, command, from)
        })
        
        return Object.assign(promise, {
          pipe: () => promise,
          kill: () => {},
          nothrow: () => promise,
          quiet: () => promise,
        })
      }
    },

    docker(config: any) {
      // Return a $ function that uses Docker adapter
      return (pieces: TemplateStringsArray, ...args: any[]) => {
        const command = pieces
          .map((piece, i) => piece + (args[i] ?? ''))
          .join('')
          .trim()
        
        const from = new Error().stack?.split('\n')[2] ?? ''
        const engine = createUxecEngine(options)
        const adapter = new DockerAdapter(config)
        
        const cmd: Command = {
          command,
          args: [],
          options: {
            cwd: options.cwd,
            env: options.env as Record<string, string>,
          }
        }
        
        const uxecPromise = engine.execute(cmd, adapter)
        
        // Convert to ProcessPromise-like object
        const promise = uxecPromise.then(async (processPromise) => {
          const result = await processPromise
          return new ProcessOutputAdapter(result, command, from)
        })
        
        return Object.assign(promise, {
          pipe: () => promise,
          kill: () => {},
          nothrow: () => promise,
          quiet: () => promise,
        })
      }
    }
  })

  return $ as Shell
}