import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $, cd, within } from '../../../src/core';
import { ProcessOutput } from '@onix-js/uxec';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

describe('cd and within functions', () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(async () => {
    originalCwd = $.cwd;
    // Create a temporary directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'xs-cd-test-'));
  });

  afterEach(async () => {
    $.cwd = originalCwd;
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('cd function', () => {
    it('should change working directory', async () => {
      const initialPwd = await $`pwd`;
      
      cd('/tmp');
      const newPwd = await $`pwd`;
      
      expect(newPwd.stdout.trim()).toBe('/tmp');
      expect($.cwd).toBe('/tmp');
    });

    it('should resolve relative paths', async () => {
      cd('/tmp');
      cd('..');
      
      const pwd = await $`pwd`;
      expect(pwd.stdout.trim()).toBe('/');
    });

    it('should handle ~ in paths', async () => {
      const home = process.env.HOME || process.env.USERPROFILE;
      if (!home) {
        // Skip test if HOME is not set
        return;
      }
      
      cd('~');
      expect($.cwd).toBe(home);
    });

    it('should accept ProcessOutput as argument', async () => {
      // Create a command that outputs a directory
      const dirOutput = await $`echo ${tempDir}`;
      
      cd(dirOutput);
      const pwd = await $`pwd`;
      
      expect(pwd.stdout.trim()).toBe(tempDir);
    });

    it('should throw on invalid directory', () => {
      expect(() => {
        cd('/path/that/does/not/exist/surely');
      }).toThrow();
    });

    it('should work with spaces in directory names', async () => {
      const dirWithSpaces = join(tempDir, 'dir with spaces');
      await $`mkdir -p ${dirWithSpaces}`;
      
      cd(dirWithSpaces);
      const pwd = await $`pwd`;
      
      expect(pwd.stdout.trim()).toBe(dirWithSpaces);
    });
  });

  describe('within function', () => {
    it('should execute callback with modified options', async () => {
      const result = await within(async () => {
        $.cwd = '/tmp';
        $.env.WITHIN_TEST = 'test_value';
        
        const pwd = await $`pwd`;
        const env = await $`echo $WITHIN_TEST`;
        
        return { pwd: pwd.stdout.trim(), env: env.stdout.trim() };
      });
      
      expect(result.pwd).toBe('/tmp');
      expect(result.env).toBe('test_value');
      
      // Options should be restored
      expect($.cwd).toBe(originalCwd);
      expect($.env.WITHIN_TEST).toBeUndefined();
    });

    it('should isolate changes to $ options', async () => {
      $.verbose = false;
      $.quiet = false;
      
      await within(async () => {
        $.verbose = true;
        $.quiet = true;
        
        expect($.verbose).toBe(true);
        expect($.quiet).toBe(true);
      });
      
      expect($.verbose).toBe(false);
      expect($.quiet).toBe(false);
    });

    it('should handle errors without affecting outer scope', async () => {
      const originalShell = $.shell;
      
      await expect(within(async () => {
        $.shell = false;
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
      
      expect($.shell).toBe(originalShell);
    });

    it('should support nested within calls', async () => {
      $.env.LEVEL = '0';
      
      const result = await within(async () => {
        $.env.LEVEL = '1';
        
        const level1 = await within(async () => {
          $.env.LEVEL = '2';
          
          const level2 = await within(async () => {
            $.env.LEVEL = '3';
            return $.env.LEVEL;
          });
          
          return { level2, currentLevel: $.env.LEVEL };
        });
        
        return { ...level1, level1: $.env.LEVEL };
      });
      
      expect(result.level2).toBe('3');
      expect(result.currentLevel).toBe('2');
      expect(result.level1).toBe('1');
      expect($.env.LEVEL).toBe('0');
    });

    it('should propagate return values', async () => {
      const result = await within(() => {
        return 42;
      });
      
      expect(result).toBe(42);
    });

    it('should work with async functions', async () => {
      const result = await within(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });
      
      expect(result).toBe('async result');
    });

    it('should preserve ProcessPromise behavior', async () => {
      const result = await within(async () => {
        const output = await $`echo "within test"`;
        return output.stdout.trim();
      });
      
      expect(result).toBe('within test');
    });
  });
});