import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { ProcessOutput } from '@onix-js/uxec';

describe('$ function', () => {
  // Store original values
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;
  let originalShell: string | boolean;
  let originalVerbose: boolean;
  let originalQuiet: boolean;

  beforeEach(() => {
    // Save original values
    originalEnv = { ...$.env };
    originalCwd = $.cwd;
    originalShell = $.shell;
    originalVerbose = $.verbose;
    originalQuiet = $.quiet;
  });

  afterEach(() => {
    // Restore original values
    $.env = originalEnv;
    $.cwd = originalCwd;
    $.shell = originalShell as string | true;
    $.verbose = originalVerbose;
    $.quiet = originalQuiet;
    
    // Clean up any test env vars
    delete process.env.ZX_TEST_FOO;
    delete process.env.ZX_TEST_BAR;
  });

  describe('Basic functionality', () => {
    it('should be a regular function', async () => {
      const _$ = $.bind(null);
      const result = await _$`echo foo`;
      
      expect(result.stdout).toBe('foo\n');
      expect(typeof $.call).toBe('function');
      expect(typeof $.apply).toBe('function');
    });

    it('should execute simple commands', async () => {
      const result = await $`echo "Hello, World!"`;
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello, World!\n');
      expect(result.stderr).toBe('');
    });

    it('should handle command substitution using only stdout', async () => {
      const hello = await $`echo Error >&2; echo Hello`;
      const len = +(await $`echo ${hello} | wc -c`);
      
      expect(len).toBe(6);
    });
  });

  describe('Environment variables', () => {
    it('should access environment variables', async () => {
      process.env.ZX_TEST_FOO = 'foo';
      const result = await $`echo $ZX_TEST_FOO`;
      
      expect(result.stdout).toBe('foo\n');
    });

    it('should safely pass environment variables', async () => {
      process.env.ZX_TEST_BAR = 'hi; exit 1';
      const result = await $`echo $ZX_TEST_BAR`;
      
      expect(result.stdout).toBe('hi; exit 1\n');
    });

    it('should work with $.env modifications', async () => {
      $.env.CUSTOM_TEST_VAR = 'custom_value';
      const result = await $`echo $CUSTOM_TEST_VAR`;
      
      expect(result.stdout).toBe('custom_value\n');
      
      // Cleanup
      delete $.env.CUSTOM_TEST_VAR;
    });
  });

  describe('Argument quoting', () => {
    it('should quote arguments properly', async () => {
      const specialChars = 'bar"";baz!$#^$\'&*~*%)({}||\\/';
      const result = await $`echo ${specialChars}`;
      
      expect(result.stdout.trim()).toBe(specialChars);
    });

    it('should handle spaces in arguments', async () => {
      const arg = 'hello world';
      const result = await $`echo ${arg}`;
      
      expect(result.stdout.trim()).toBe('hello world');
    });

    it('should handle newlines in arguments', async () => {
      const arg = 'line1\nline2';
      const result = await $`printf ${arg}`;
      
      expect(result.stdout).toBe('line1\nline2');
    });

    it('should handle empty arguments', async () => {
      const empty = '';
      const result = await $`echo "start${empty}end"`;
      
      expect(result.stdout).toBe('startend\n');
    });
  });

  describe('Template literal features', () => {
    it('should support multiline commands', async () => {
      const result = await $`
        echo "line1"
        echo "line2"
      `;
      
      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
    });

    it('should support expressions in templates', async () => {
      const num = 42;
      const result = await $`echo ${num * 2}`;
      
      expect(result.stdout).toBe('84\n');
    });

    it('should support array interpolation', async () => {
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      const result = await $`echo ${files}`;
      
      expect(result.stdout).toBe('file1.txt file2.txt file3.txt\n');
    });
  });

  describe('Error handling', () => {
    it('should throw on non-zero exit by default', async () => {
      await expect($`exit 1`).rejects.toThrow();
    });

    it('should not throw with nothrow()', async () => {
      const result = await $`exit 1`.nothrow();
      
      expect(result.exitCode).toBe(1);
    });

    it('should handle command not found', async () => {
      const result = await $`command-that-does-not-exist-surely`.nothrow();
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('command-that-does-not-exist-surely');
    });
  });

  describe('Configuration options', () => {
    it('should respect quiet mode', async () => {
      // TODO: Test quiet mode when stdout capture is implemented
      const result = await $`echo "test"`.quiet();
      
      expect(result.stdout).toBe('test\n');
    });

    it('should respect verbose mode', async () => {
      $.verbose = true;
      // In verbose mode, commands are logged
      // TODO: Capture and verify console output
      const result = await $`echo "verbose test"`;
      
      expect(result.stdout).toBe('verbose test\n');
    });

    it('should support custom cwd', async () => {
      const result = await $`pwd`;
      const originalPwd = result.stdout.trim();
      
      $.cwd = '/tmp';
      const tmpResult = await $`pwd`;
      
      expect(tmpResult.stdout.trim()).toBe('/tmp');
      expect(tmpResult.stdout.trim()).not.toBe(originalPwd);
    });

    it('should support timeout', async () => {
      await expect(
        $`sleep 2`.timeout(100)
      ).rejects.toThrow();
    });
  });

  describe('ProcessOutput interface', () => {
    it('should provide stdout, stderr, and exitCode', async () => {
      const result = await $`echo "stdout"; echo "stderr" >&2; exit 0`;
      
      expect(result).toBeInstanceOf(ProcessOutput);
      expect(result.stdout).toBe('stdout\n');
      expect(result.stderr).toBe('stderr\n');
      expect(result.exitCode).toBe(0);
    });

    it('should support toString()', async () => {
      const result = await $`echo "test output"`;
      
      expect(result.toString()).toBe('test output');
    });

    it('should throw ProcessOutput on error', async () => {
      try {
        await $`exit 42`;
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessOutput);
        expect((error as ProcessOutput).exitCode).toBe(42);
      }
    });
  });
});