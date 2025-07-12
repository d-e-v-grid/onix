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

import {
  createXsShell,
  type XsOptions,
  type XsProcessPromise,
  ProcessOutput as UxecProcessOutput,
} from '@onix-js/uxec'

import type { Shell, Options, ProcessPromise, ProcessOutput } from './core.js'
import { CWD, SYNC } from './core.js'

/**
 * Convert xs Options to uxec XsOptions
 */
function convertOptions(options: Options): XsOptions {
  // Convert timeout if it's a Duration string
  let timeout: number | undefined;
  if (options.timeout) {
    if (typeof options.timeout === 'number') {
      timeout = options.timeout;
    } else if (typeof options.timeout === 'string') {
      // Parse duration strings like '10s', '5m', etc.
      const match = options.timeout.match(/^(\d+)(m?s?)$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        timeout = unit === 'm' ? value * 60000 : 
                  unit === 's' ? value * 1000 : 
                  unit === 'ms' ? value : value;
      }
    }
  }

  // Convert stdio options
  let stdio: 'pipe' | 'inherit' | 'ignore' | Array<'pipe' | 'inherit' | 'ignore'> | undefined;
  if (options.stdio) {
    if (options.stdio === 'overlapped') {
      stdio = 'pipe'; // fallback for Windows 'overlapped'
    } else if (Array.isArray(options.stdio)) {
      stdio = options.stdio.filter(s => s === 'pipe' || s === 'inherit' || s === 'ignore') as Array<'pipe' | 'inherit' | 'ignore'>;
    } else if (options.stdio === 'pipe' || options.stdio === 'inherit' || options.stdio === 'ignore') {
      stdio = options.stdio;
    }
  }

  return {
    shell: options.shell,
    prefix: options.prefix,
    postfix: options.postfix,
    quote: options.quote,
    cwd: options.cwd,
    env: options.env,
    timeout,
    timeoutSignal: options.timeoutSignal,
    ac: options.ac,
    signal: options.signal,
    spawn: options.spawn,
    log: options.log,
    delimiter: options.delimiter,
    nothrow: options.nothrow,
    quiet: options.quiet,
    verbose: options.verbose,
    input: options.input as any, // Type compatibility between xs ProcessOutput and uxec ProcessOutput
    preferLocal: options.preferLocal,
    detached: options.detached,
    stdio,
    store: options.store,
    sync: options.sync,
    halt: options.halt,
  }
}

/**
 * Create a Shell function using uxec backend
 */
export function createUxecShell(options: Options): Shell {
  const xsOptions = convertOptions(options)
  const $ = createXsShell(xsOptions)
  
  // Add xs-specific symbols and properties
  Object.defineProperty($, CWD, {
    value: options[CWD] || process.cwd(),
    writable: true,
    enumerable: false,
    configurable: true
  });
  
  Object.defineProperty($, SYNC, {
    value: options[SYNC] || false,
    writable: true,
    enumerable: false,
    configurable: true
  });
  
  // The uxec implementation already provides all the functionality
  // we need, including $.sync, $.ssh, $.docker, etc.
  // We just need to ensure type compatibility
  
  return $ as Shell
}

/**
 * Helper to ensure ProcessOutput compatibility
 * The uxec ProcessOutput should already be compatible with xs ProcessOutput
 */
export function ensureProcessOutputCompat(output: UxecProcessOutput): ProcessOutput {
  // uxec ProcessOutput is designed to be compatible with xs ProcessOutput
  // but we can add any necessary conversions here if needed
  return output as unknown as ProcessOutput
}

/**
 * Helper to ensure ProcessPromise compatibility
 */
export function ensureProcessPromiseCompat(promise: XsProcessPromise): ProcessPromise {
  // uxec XsProcessPromise is designed to be compatible with xs ProcessPromise
  // but we can add any necessary conversions here if needed
  return promise as unknown as ProcessPromise
}