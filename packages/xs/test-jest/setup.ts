import { jest } from '@jest/globals';

// Mock @onix-js/uxec with a real child_process implementation
jest.mock('@onix-js/uxec', () => {
  const child_process = jest.requireActual('child_process') as typeof import('child_process');
  const { exec } = child_process;
  
  class ProcessOutput {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    duration: number;
    command: string;
    cwd?: string;
    
    constructor(data: any) {
      this.stdout = data.stdout || '';
      this.stderr = data.stderr || '';
      this.exitCode = data.exitCode ?? 0;
      this.signal = data.signal || null;
      this.duration = data.duration || 0;
      this.command = data.command || '';
      this.cwd = data.cwd || process.cwd();
    }
    
    toString() { return this.stdout.trim(); }
    valueOf() { return this.stdout.trim(); }
    text() { return this.stdout.trim(); }
    json() { return JSON.parse(this.stdout); }
    buffer() { return Buffer.from(this.stdout); }
    lines() { return this.stdout.split('\n').filter(Boolean); }
    blob() { return new Blob([this.stdout]); }
  }

  return {
    createXsShell: jest.fn((options: any) => {
      const mockShell = function(pieces: TemplateStringsArray, ...args: any[]) {
        // Build command string
        let cmd = pieces[0];
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          const val = arg?.stdout !== undefined ? arg.stdout.trim() : String(arg);
          cmd += val + pieces[i + 1];
        }
        
        // Create process promise
        const promise = new Promise<ProcessOutput>((resolve, reject) => {
          const startTime = Date.now();
          
          exec(cmd, {
            cwd: options?.cwd || process.cwd(),
            env: options?.env || process.env,
            shell: options?.shell === false ? undefined : '/bin/sh',
          }, (error, stdout, stderr) => {
            const duration = Date.now() - startTime;
            const output = new ProcessOutput({
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode: error ? error.code || 1 : 0,
              signal: error?.signal || null,
              duration,
              command: cmd,
              cwd: options?.cwd,
            });
            
            if (error && !promise._nothrow) {
              reject(output);
            } else {
              resolve(output);
            }
          });
        }) as any;
        
        // Add ProcessPromise methods
        promise._nothrow = false;
        promise._quiet = false;
        promise._verbose = false;
        
        promise.stdin = process.stdin;
        promise.stdout = process.stdout;
        promise.stderr = process.stderr;
        promise.exitCode = promise.then(o => o.exitCode);
        promise.cmd = cmd;
        
        promise.pipe = jest.fn(() => promise);
        promise.kill = jest.fn();
        
        promise.nothrow = () => {
          promise._nothrow = true;
          return promise;
        };
        
        promise.quiet = () => {
          promise._quiet = true;
          return promise;
        };
        
        promise.verbose = () => {
          promise._verbose = true;
          return promise;
        };
        
        promise.timeout = () => promise;
        promise.halt = () => promise;
        
        return promise;
      } as any;
      
      // Add sync method
      mockShell.sync = jest.fn((pieces: TemplateStringsArray, ...args: any[]) => {
        let cmd = pieces[0];
        for (let i = 0; i < args.length; i++) {
          cmd += String(args[i]) + pieces[i + 1];
        }
        
        try {
          const result = child_process.execSync(cmd, {
            cwd: options?.cwd || process.cwd(),
            env: options?.env || process.env,
          });
          
          return new ProcessOutput({
            stdout: result.toString(),
            stderr: '',
            exitCode: 0,
            signal: null,
            duration: 0,
            command: cmd,
            cwd: options?.cwd,
          });
        } catch (error: any) {
          return new ProcessOutput({
            stdout: error.stdout?.toString() || '',
            stderr: error.stderr?.toString() || '',
            exitCode: error.status || 1,
            signal: error.signal || null,
            duration: 0,
            command: cmd,
            cwd: options?.cwd,
          });
        }
      });
      
      // Copy options to shell
      Object.assign(mockShell, options);
      
      return mockShell;
    }),
    ProcessOutput,
  };
});

// Mock modules that cause issues in Jest
jest.mock('chalk', () => ({
  default: {
    level: 1,
    red: jest.fn((str) => str),
    green: jest.fn((str) => str),
    blue: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    cyan: jest.fn((str) => str),
    magenta: jest.fn((str) => str),
    gray: jest.fn((str) => str),
    grey: jest.fn((str) => str),
    white: jest.fn((str) => str),
    black: jest.fn((str) => str),
    bold: jest.fn((str) => str),
    dim: jest.fn((str) => str),
    italic: jest.fn((str) => str),
    underline: jest.fn((str) => str),
    inverse: jest.fn((str) => str),
    hidden: jest.fn((str) => str),
    strikethrough: jest.fn((str) => str),
    visible: jest.fn((str) => str),
    hex: jest.fn(() => jest.fn((str) => str)),
    rgb: jest.fn(() => jest.fn((str) => str)),
    bgRed: jest.fn((str) => str),
    bgGreen: jest.fn((str) => str),
    bgBlue: jest.fn((str) => str),
    bgYellow: jest.fn((str) => str),
  }
}));

jest.mock('which', () => ({
  default: jest.fn((cmd) => `/usr/bin/${cmd}`),
  sync: jest.fn((cmd) => `/usr/bin/${cmd}`)
}));

jest.mock('@webpod/ps', () => ({
  default: {
    lookup: jest.fn(),
    lookupSync: jest.fn(),
    kill: jest.fn(),
    tree: jest.fn(),
    treeSync: jest.fn()
  }
}));

jest.mock('zurk', () => ({
  exec: jest.fn(),
  buildCmd: jest.fn(),
  VoidStream: class VoidStream {},
  isStringLiteral: jest.fn((v) => Array.isArray(v)),
}));

// Mock fs-extra
jest.mock('fs-extra', () => {
  const fs = jest.requireActual('fs') as any;
  return {
  ...fs,
  copy: jest.fn(),
  copySync: jest.fn(),
  emptyDir: jest.fn(),
  emptyDirSync: jest.fn(),
  ensureDir: jest.fn(),
  ensureDirSync: jest.fn(),
  ensureFile: jest.fn(),
  ensureFileSync: jest.fn(),
  ensureLink: jest.fn(),
  ensureLinkSync: jest.fn(),
  ensureSymlink: jest.fn(),
  ensureSymlinkSync: jest.fn(),
  mkdirp: jest.fn(),
  mkdirpSync: jest.fn(),
  mkdirs: jest.fn(),
  mkdirsSync: jest.fn(),
  move: jest.fn(),
  moveSync: jest.fn(),
  outputFile: jest.fn(),
  outputFileSync: jest.fn(),
  pathExists: jest.fn(),
  pathExistsSync: jest.fn(),
  remove: jest.fn(),
  removeSync: jest.fn(),
  createFile: jest.fn(),
  createFileSync: jest.fn(),
  createLink: jest.fn(),
  createLinkSync: jest.fn(),
  createSymlink: jest.fn(),
  createSymlinkSync: jest.fn(),
  emptydir: jest.fn(),
  emptydirSync: jest.fn(),
  default: {},
  readJsonSync: jest.fn(() => ({ version: '1.0.0' }))
  };
});

// Mock other problematic modules
jest.mock('globby', () => ({
  globby: jest.fn(() => Promise.resolve([])),
  globbySync: jest.fn(() => []),
  globbyStream: jest.fn(),
  generateGlobTasks: jest.fn(),
  generateGlobTasksSync: jest.fn(),
  isDynamicPattern: jest.fn(),
  isGitIgnored: jest.fn(),
  isGitIgnoredSync: jest.fn(),
  convertPathToPattern: jest.fn(),
}));

jest.mock('yaml', () => ({
  parse: jest.fn(),
  stringify: jest.fn(),
  parseAllDocuments: jest.fn(),
  parseDocument: jest.fn(),
  isAlias: jest.fn(),
  isCollection: jest.fn(),
  isDocument: jest.fn(),
  isMap: jest.fn(),
  isNode: jest.fn(),
  isPair: jest.fn(),
  isScalar: jest.fn(),
  isSeq: jest.fn(),
  visit: jest.fn(),
  visitAsync: jest.fn(),
  CST: {},
  default: {},
  Alias: jest.fn(),
  Composer: jest.fn(),
  Document: jest.fn(),
  Schema: jest.fn(),
  YAMLSeq: jest.fn(),
  YAMLMap: jest.fn(),
  YAMLError: jest.fn(),
  YAMLParseError: jest.fn(),
  YAMLWarning: jest.fn(),
  Pair: jest.fn(),
  Scalar: jest.fn(),
  Lexer: jest.fn(),
  LineCounter: jest.fn(),
  Parser: jest.fn(),
}));

jest.mock('minimist', () => ({
  default: jest.fn((args) => ({ _: args }))
}));

jest.mock('envapi', () => ({
  default: {
    config: jest.fn(),
    load: jest.fn(),
    loadSafe: jest.fn(),
    parse: jest.fn(),
    stringify: jest.fn()
  }
}));

jest.mock('depseek', () => ({
  depseekSync: jest.fn()
}));

jest.mock('node-fetch-native', () => ({
  fetch: jest.fn(),
  AbortController: globalThis.AbortController || class AbortController {}
}));

// Silence console during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};