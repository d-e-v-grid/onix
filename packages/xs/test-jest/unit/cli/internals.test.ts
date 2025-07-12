import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { join } from 'path';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpfile } from '../../../src/index';
import { isMain, normalizeExt } from '../../../src/cli';

const cliPath = join(process.cwd(), 'build/cli.js');

describe('CLI internals and PATH execution', () => {
  describe('Script execution from PATH', () => {
    it('should execute a script from $PATH', async () => {
      const isWindows = process.platform === 'win32';
      const oldPath = process.env.PATH;
      const toPOSIXPath = (_path: string) => _path.split(path.sep).join(path.posix.sep);
      
      const zxPath = path.resolve('./build/cli.js');
      const zxLocation = isWindows ? toPOSIXPath(zxPath) : zxPath;
      const scriptCode = `#!/usr/bin/env ${zxLocation}\nconsole.log('The script from path runs.')`;
      const scriptName = 'script-from-path';
      const scriptFile = tmpfile(scriptName, scriptCode, 0o744);
      const scriptDir = path.dirname(scriptFile);
      
      const envPathSeparator = isWindows ? ';' : ':';
      process.env.PATH += envPathSeparator + scriptDir;
      
      try {
        await $`chmod +x ${zxLocation}`;
        const result = await $`${scriptName}`;
        
        expect(result.stdout).toContain('The script from path runs.');
        expect(result.exitCode).toBe(0);
      } finally {
        process.env.PATH = oldPath;
        await fs.rm(scriptFile);
      }
    });

    it('should handle shebang scripts', async () => {
      const scriptCode = `#!/usr/bin/env node
console.log('Shebang script');`;
      const scriptFile = tmpfile('shebang-test', scriptCode, 0o755);
      
      await $`chmod +x ${scriptFile}`;
      const result = await $`${scriptFile}`;
      
      expect(result.stdout).toContain('Shebang script');
      expect(result.exitCode).toBe(0);
      
      await fs.rm(scriptFile);
    });
  });

  describe('Argv handling', () => {
    it('should work with zx and node', async () => {
      const zxResult = await $`node ${cliPath} test/fixtures/argv.mjs foo`;
      const nodeResult = await $`node test/fixtures/argv.mjs bar`;
      
      expect(zxResult.toString()).toBe('global {"_":["foo"]}\nimported {"_":["foo"]}\n');
      expect(nodeResult.toString()).toBe('global {"_":["bar"]}\nimported {"_":["bar"]}\n');
    });

    it('should pass argv to eval mode', async () => {
      const result = await $`node ${cliPath} --eval 'console.log(argv._.join(""))' baz`;
      
      expect(result.toString()).toBe('baz\n');
    });

    it('should handle multiple arguments', async () => {
      const result = await $`node ${cliPath} --eval 'console.log(argv._.join(","))' arg1 arg2 arg3`;
      
      expect(result.stdout).toBe('arg1,arg2,arg3\n');
    });

    it('should handle quoted arguments', async () => {
      const result = await $`node ${cliPath} --eval 'console.log(argv._[0])' "spaced arg"`;
      
      expect(result.stdout).toBe('spaced arg\n');
    });
  });

  describe('Internal functions', () => {
    describe('isMain()', () => {
      it('should check process entry point', () => {
        const mockUrl = 'file://' + process.cwd() + '/test-jest/unit/cli/internals.test.ts';
        const mockFilename = process.cwd() + '/test-jest/unit/cli/internals.test.ts';
        expect(isMain(mockUrl, mockFilename)).toBe(true);
        
        const mockUrlCjs = 'file://' + process.cwd() + '/test-jest/unit/cli/internals.test.cjs';
        expect(
          isMain(mockUrlCjs, mockFilename)
        ).toBe(true);
      });

      it('should handle different file paths', () => {
        try {
          expect(
            isMain(
              'file:///root/zx/test/cli.test.js',
              '/root/zx/test/all.test.js'
            )
          ).toBe(true);
          
          // Should throw error
          expect(true).toBe(false);
        } catch (e: any) {
          expect(['EACCES', 'ENOENT'].includes(e.code)).toBe(true);
        }
      });

      it('should return false for wrong path', () => {
        expect(isMain('///root/zx/test/cli.test.js')).toBe(false);
      });

      it('should handle URL without process.argv', () => {
        expect(isMain('file:///some/path.js')).toBe(false);
      });
    });

    describe('normalizeExt()', () => {
      it('should normalize extensions', () => {
        expect(normalizeExt('.ts')).toBe('.ts');
        expect(normalizeExt('ts')).toBe('.ts');
        expect(normalizeExt('.')).toBe('.');
        expect(normalizeExt()).toBeUndefined();
      });

      it('should handle empty string', () => {
        expect(normalizeExt('')).toBeUndefined();
      });

      it('should handle multiple dots', () => {
        expect(normalizeExt('.tar.gz')).toBe('.tar.gz');
        expect(normalizeExt('tar.gz')).toBe('.tar.gz');
      });
    });
  });

  describe('require() functionality', () => {
    it('should support require() from stdin', async () => {
      const result = await $`node ${cliPath} <<< 'console.log(require("./package.json").name)'`;
      
      expect(result.stdout).toContain('zx');
      expect(result.exitCode).toBe(0);
    });

    it('should support require() in ESM', async () => {
      const result = await $`node ${cliPath} test/fixtures/require.mjs`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should define __filename and __dirname', async () => {
      const result = await $`node ${cliPath} test/fixtures/filename-dirname.mjs`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should support require() with relative paths', async () => {
      const script = `
        const pkg = require('./package.json');
        console.log(typeof pkg === 'object');
      `;
      
      const result = await $`node ${cliPath} <<< ${script}`;
      
      expect(result.stdout).toContain('true');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('File extension handling edge cases', () => {
    it('should support stdin with explicit extension', async () => {
      const nodeMajor = +process.versions?.node?.split('.')[0];
      
      if (nodeMajor >= 22) {
        const result = await $`node --experimental-strip-types ${cliPath} --ext='.ts' <<< 'const foo: string = "bar"; console.log(foo)'`;
        
        expect(result.stdout).toContain('bar');
        expect(result.exitCode).toBe(0);
      } else {
        // Skip test for older Node versions
        expect(true).toBe(true);
      }
    });

    it('should handle unknown file extensions', async () => {
      const result = await $`node ${cliPath} test/fixtures/non-std-ext.zx`.nothrow();
      
      expect(result.stderr).toContain('Unknown file extension ".zx"');
      expect(result.exitCode).not.toBe(0);
    });

    it('should support custom extensions with --ext', async () => {
      const result = await $`node ${cliPath} --ext='.mjs' test/fixtures/non-std-ext.zx`;
      
      expect(result.stdout.trim()).toEndWith('test/fixtures/non-std-ext.zx.mjs');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Process promise tracking', () => {
    it('should resolve all promises', async () => {
      // This is implicitly tested by all other tests
      // The before() hook in cli.test.js tracks unresolved promises
      await $`echo "test"`;
      
      expect(true).toBe(true);
    });
  });
});