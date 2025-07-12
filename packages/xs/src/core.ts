// Copyright 2021 Google LLC
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

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { inspect } from 'node:util'
import { Buffer } from 'node:buffer'
import { EOL as _EOL } from 'node:os'
import { EventEmitter } from 'node:events'
import { type Encoding } from 'node:crypto'
import { type Readable, type Writable } from 'node:stream'
import { createHook, type AsyncHook, AsyncLocalStorage } from 'node:async_hooks'
import {
  spawn,
  spawnSync,
  type IOType,
  type ChildProcess,
  type StdioOptions,
} from 'node:child_process'

import { log } from './log.js'
import {
  getExitCodeInfo,
  formatExitMessage,
  getCallerLocation,
  formatErrorDetails,
  formatErrorMessage,
} from './error.js'
import {
  ps,
  exec,
  chalk,
  which,
  buildCmd,
  VoidStream,
  type TSpawnStore,
  type TSpawnResult,
} from './vendor-core.js'
import {
  noop,
  once,
  quote,
  getLast,
  isString,
  getLines,
  randomId,
  parseBool,
  bufArrJoin,
  toCamelCase,
  type Duration,
  parseDuration,
  proxyOverride,
  preferLocalBin,
  isStringLiteral,
  quotePowerShell,
} from './util.js'
import { createUxecShell } from './uxec-adapter.js'
import { ProcessOutput as UxecProcessOutput, type XsProcessPromise } from '@onix-js/uxec'

export * as os from 'node:os'
export { default as path } from 'node:path'
export { log, type LogEntry } from './log.js'
export { quote, quotePowerShell } from './util.js'
export { ps, chalk, which } from './vendor-core.js'

export const CWD = Symbol('processCwd')
export const SYNC = Symbol('syncExec')
const EOL = Buffer.from(_EOL)
const BR_CC = '\n'.charCodeAt(0)
const DLMTR = /\r?\n/
const SIGTERM = 'SIGTERM'
const ENV_PREFIX = 'ZX_'
const ENV_OPTS: Set<string> = new Set([
  'cwd',
  'preferLocal',
  'detached',
  'verbose',
  'quiet',
  'timeout',
  'timeoutSignal',
  'killSignal',
  'prefix',
  'postfix',
  'shell',
])
const storage = new AsyncLocalStorage<Options>()

function getStore() {
  return storage.getStore() || defaults
}

export function within<R>(callback: () => R): R {
  return storage.run({ ...getStore() }, callback)
}
// prettier-ignore
export interface Options {
  [CWD]: string
  [SYNC]: boolean
  cwd?: string
  ac?: AbortController
  signal?: AbortSignal
  input?: string | Buffer | Readable | ProcessOutput | ProcessPromise
  timeout?: Duration
  timeoutSignal?: NodeJS.Signals
  stdio: StdioOptions
  verbose: boolean
  sync: boolean
  env: NodeJS.ProcessEnv
  shell: string | true
  nothrow: boolean
  prefix?: string
  postfix?: string
  quote?: typeof quote
  quiet: boolean
  detached: boolean
  preferLocal: boolean | string | string[]
  spawn: typeof spawn
  spawnSync: typeof spawnSync
  store?: TSpawnStore
  log: typeof log
  kill: typeof kill
  killSignal?: NodeJS.Signals
  halt?: boolean
  delimiter?: string | RegExp
}

// prettier-ignore
export const defaults: Options = resolveDefaults({
  [CWD]: process.cwd(),
  [SYNC]: false,
  cwd: process.cwd(),
  verbose: false,
  env: process.env,
  sync: false,
  shell: true,
  stdio: 'pipe',
  nothrow: false,
  quiet: false,
  detached: false,
  preferLocal: false,
  spawn,
  spawnSync,
  log,
  kill,
  killSignal: SIGTERM,
  timeoutSignal: SIGTERM,
})

// prettier-ignore
export interface Shell<
  S = false,
  R = S extends true ? ProcessOutput : ProcessPromise,
> {
  (pieces: TemplateStringsArray, ...args: any[]): R
  <O extends Partial<Options> = Partial<Options>, R = O extends { sync: true } ? Shell<true> : Shell>(opts: O): R
  sync: {
    (pieces: TemplateStringsArray, ...args: any[]): ProcessOutput
    (opts: Partial<Omit<Options, 'sync'>>): Shell<true>
  }
}
const boundCtxs: [string, string, Options][] = []
const delimiters: Array<string | RegExp | undefined> = []

// Re-export ProcessOutput from uxec
export { ProcessOutput } from '@onix-js/uxec'

// ProcessPromise is now a type alias for XsProcessPromise from uxec
export type ProcessPromise = XsProcessPromise

// Create the $ shell using uxec adapter
const shell = createUxecShell(defaults)
// Store the sync function before it gets overwritten
const syncFunction = shell.sync
// Ensure all Options properties are available on $
export const $: Shell & Options = Object.assign(shell, defaults) as Shell & Options
// Restore the sync function
if (syncFunction) {
  Object.defineProperty($, 'sync', {
    value: syncFunction,
    writable: true,
    enumerable: true,
    configurable: true
  })
}

// Utility functions that need to be adapted
export function cd(dir: string | ProcessOutput): void {
  if (dir instanceof ProcessOutput) {
    dir = dir.stdout.trimEnd()
  }
  $.cwd = path.resolve($.cwd || process.cwd(), dir)
}

export function resolveDefaults(
  defs: Omit<Options, 'env'> & { env?: NodeJS.ProcessEnv },
  prefix: string = ENV_PREFIX,
  envOverrides: NodeJS.ProcessEnv = process.env,
  skipKeys?: Set<string>
): Options {
  const env = Object.create(process.env);
  Object.assign(env, defs.env);

  // Apply prefix environment variables (e.g. ZX_*)
  for (const key in envOverrides) {
    if (key.startsWith(prefix)) {
      const optionKey = toCamelCase(key.slice(prefix.length))
      if (ENV_OPTS.has(optionKey) && (!skipKeys || !skipKeys.has(optionKey))) {
        const val = envOverrides[key]
        if (typeof val === 'string') {
          try {
            if (optionKey === 'timeout') {
              ;(defs as any)[optionKey] = parseDuration(val as Duration)
            } else if (
              ['verbose', 'quiet', 'preferLocal', 'detached'].includes(
                optionKey
              )
            ) {
              ;(defs as any)[optionKey] = parseBool(val)
            } else {
              ;(defs as any)[optionKey] = val
            }
          } catch (err) {
            throw new Error(
              `ZX: Unable to parse env $${key}="${val}": ${err}`
            )
          }
        }
      }
    }
  }

  return { ...defs, env: env as NodeJS.ProcessEnv }
}

// Original kill function
export function kill(child: ChildProcess, signal?: NodeJS.Signals) {
  if (!child.pid) throw new Error('No PID found for process')
  child.kill(signal)
}

// For backward compatibility
export function checkShell() {
  if (!$.shell)
    throw new Error(`The "shell" option is disabled`)
}

export function checkQuote() {
  if (!$.quote)
    throw new Error(`The "quote" option is disabled`)
}