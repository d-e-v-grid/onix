// Copyright 2024 Google LLC
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

// Minimal vendor-extra for xs using uxec backend
// This provides stubs for all the functions that vendor-extra.ts provides

import { URL } from 'node:url'
import { bus } from './internals.js'

const { wrap } = bus

// Stub implementations
const _minimist = (args?: string[], opts?: any) => {
  // Basic argument parsing for minimal build
  const result: any = { _: [] }
  
  if (!args) return result
  
  const aliases = opts?.alias || {}
  const booleans = new Set(opts?.boolean || [])
  const strings = new Set(opts?.string || [])
  
  // Helper function to set value and aliases
  const setValue = (key: string, value: any) => {
    result[key] = value
    // Set aliases
    if (aliases[key]) {
      const aliasKey = aliases[key]
      result[aliasKey] = value
    }
    // Reverse aliases
    for (const [aliasKey, aliasValue] of Object.entries(aliases)) {
      if (aliasValue === key) {
        result[aliasKey] = value
      }
    }
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (key.includes('=')) {
        const [k, v] = key.split('=', 2)
        setValue(k, v)
      } else {
        // Check if it's a boolean flag or needs a value
        if (booleans.has(key)) {
          setValue(key, true)
        } else {
          // Check if next arg is a value
          const nextArg = args[i + 1]
          if (nextArg && !nextArg.startsWith('-')) {
            setValue(key, nextArg)
            i++ // skip next arg
          } else {
            setValue(key, true)
          }
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const flags = arg.slice(1)
      for (const flag of flags) {
        setValue(flag, true)
      }
    } else {
      result._.push(arg)
    }
  }
  
  return result
}
const _depseek = (dependencies: any, scripts: any) => ({
  reduce: (fn: any, init: any) => init
})

const _dotenv = { 
  config: (options?: string | { path?: string }) => ({
    parsed: {},
    error: undefined
  })
}

const _fs = {
  existsSync: (path: string) => false,
  readFile: async (path: string, encoding?: string) => '',
  writeFile: async (path: string, data: any) => {},
  rmSync: (path: string, options?: any) => {},
  symlinkSync: (target: string, path: string, type?: string) => {},
  realpathSync: (path: string) => path,
  readJsonSync: (path: string | URL, options?: any) => ({ version: '8.7.0' })
}

const _nodeFetch = (url: any, init?: any) => Promise.resolve(new Response())

export interface YAML {
  parse(text: string): any
  stringify(object: any): string
  /** @deprecated */
  parseAllDocuments(s: string, opts?: any): any[]
  /** @deprecated */
  parseDocument(s: string, opts?: any): any
  /** @deprecated */
  isAlias(v: any): boolean
  /** @deprecated */
  isCollection(v: any): boolean
  /** @deprecated */
  isDocument(v: any): boolean
  /** @deprecated */
  isMap(v: any): boolean
  /** @deprecated */
  isNode(v: any): boolean
  /** @deprecated */
  isPair(v: any): boolean
  /** @deprecated */
  isScalar(v: any): boolean
  /** @deprecated */
  isSeq(v: any): boolean
  /** @deprecated */
  Alias: any
  /** @deprecated */
  Composer: any
  /** @deprecated */
  Document: any
  /** @deprecated */
  Schema: any
  /** @deprecated */
  YAMLSeq: any
  /** @deprecated */
  YAMLMap: any
  /** @deprecated */
  YAMLError: any
  /** @deprecated */
  YAMLParseError: any
  /** @deprecated */
  YAMLWarning: any
  /** @deprecated */
  Pair: any
  /** @deprecated */
  Scalar: any
  /** @deprecated */
  Lexer: any
  /** @deprecated */
  LineCounter: any
  /** @deprecated */
  Parser: any
}

const _YAML: YAML = {
  parse: (text: string) => {
    throw new Error('YAML not implemented in minimal build');
  },
  stringify: (object: any) => {
    throw new Error('YAML not implemented in minimal build');
  },
  parseAllDocuments: () => { throw new Error('YAML not implemented in minimal build'); },
  parseDocument: () => { throw new Error('YAML not implemented in minimal build'); },
  isAlias: () => false,
  isCollection: () => false,
  isDocument: () => false,
  isMap: () => false,
  isNode: () => false,
  isPair: () => false,
  isScalar: () => false,
  isSeq: () => false,
  Alias: class {},
  Composer: class {},
  Document: class {},
  Schema: class {},
  YAMLSeq: class {},
  YAMLMap: class {},
  YAMLError: class {},
  YAMLParseError: class {},
  YAMLWarning: class {},
  Pair: class {},
  Scalar: class {},
  Lexer: class {},
  LineCounter: class {},
  Parser: class {},
};

const globbyModule = {
  convertPathToPattern: (pattern: string) => pattern,
  globby: (patterns?: any, options?: any) => Promise.resolve([]),
  sync: (patterns?: any, options?: any) => [],
  globbySync: (patterns?: any, options?: any) => [],
  globbyStream: (patterns?: any, options?: any) => null,
  generateGlobTasksSync: (patterns?: any, options?: any) => [],
  generateGlobTasks: (patterns?: any, options?: any) => Promise.resolve([]),
  isGitIgnoredSync: (pattern?: any) => false,
  isGitIgnored: (pattern?: any) => Promise.resolve(false),
  isDynamicPattern: (pattern?: any) => false,
};

const _glob = Object.assign(function globby(
  patterns?: string | readonly string[],
  options?: any
) {
  return globbyModule.globby(patterns || [], options)
}, globbyModule);

import { createRequire as nodeCreateRequire } from 'node:module'

export const createRequire = nodeCreateRequire

export const depseek: typeof _depseek = wrap('depseek', _depseek)
export const dotenv: typeof _dotenv = wrap('dotenv', _dotenv)
export const fs: typeof _fs = wrap('fs', _fs)
export const YAML: typeof _YAML = wrap('YAML', _YAML)
export const glob: typeof _glob = wrap('glob', _glob)
export const nodeFetch: typeof _nodeFetch = wrap('nodeFetch', _nodeFetch)

export const minimist: typeof _minimist = wrap('minimist', _minimist)
export namespace minimist {
  export interface Opts { 
    string?: string | string[];
    boolean?: string | string[];
    alias?: { [key: string]: string | string[] };
    default?: { [key: string]: any };
    stopEarly?: boolean;
    '--'?: boolean;
    unknown?: (arg: string) => boolean;
  }
  export interface ParsedArgs { 
    [arg: string]: any;
    '--'?: string[];
    _: string[];
  }
}