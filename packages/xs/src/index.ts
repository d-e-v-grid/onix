// Copyright 2022 Google LLC
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

import { fs } from './vendor.js'
import { type ProcessPromise as ProcessPromiseType } from './core.js'

export * from './core.js'
export * from './goods.js'
export { fs, YAML, glob, dotenv, minimist, glob as globby } from './vendor.js'

// For globals compatibility - ProcessPromise needs to be a constructor
export const ProcessPromise = class ProcessPromise {
  static [Symbol.hasInstance](obj: any): boolean {
    // Make instanceof work with xs ProcessPromise type
    return obj && typeof obj.then === 'function' && 
           'stdin' in obj && 'stdout' in obj && 'stderr' in obj;
  }
} as any

export const VERSION: string =
  fs.readJsonSync(new URL('../package.json', import.meta.url), {
    throws: false,
  })?.version || URL.parse(import.meta.url)!.pathname.split('/')[3] // extracts version from JSR url

export const version: string = VERSION

export {
  quote,
  tempdir,
  tempfile,
  type Duration,
  quotePowerShell,
  tempdir as tmpdir,
  tempfile as tmpfile,
} from './util.js'

/**
 *  @deprecated Use $`cmd`.nothrow() instead.
 */
export function nothrow(promise: ProcessPromiseType): ProcessPromiseType {
  return promise.nothrow()
}

/**
 * @deprecated Use $`cmd`.quiet() instead.
 */
export function quiet(promise: ProcessPromiseType): ProcessPromiseType {
  return promise.quiet()
}
