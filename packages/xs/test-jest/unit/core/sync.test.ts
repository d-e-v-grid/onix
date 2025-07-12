import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { ProcessOutput } from '@onix-js/uxec';

describe('Sync execution', () => {
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalCwd = $.cwd;
    originalEnv = { ...$.env };
  });

  afterEach(() => {
    $.cwd = originalCwd;
    $.env = originalEnv;
  });

  describe('$.sync', () => {
    it('should execute commands synchronously', () => {
      const result = $.sync`echo "sync test"`;
      
      expect(result).toBeInstanceOf(ProcessOutput);
      expect(result.stdout).toBe('sync test\n');
      expect(result.exitCode).toBe(0);
    });

    it('should throw on error by default', () => {
      expect(() => {
        $.sync`exit 1`;
      }).toThrow();
    });

    it('should respect nothrow option', () => {
      const result = $.sync({ nothrow: true })`exit 1`;
      
      expect(result.exitCode).toBe(1);
    });

    it('should handle environment variables', () => {
      $.env.SYNC_TEST = 'sync_value';
      const result = $.sync`echo $SYNC_TEST`;
      
      expect(result.stdout).toBe('sync_value\n');
      
      delete $.env.SYNC_TEST;
    });

    it('should respect cwd option', () => {
      const result1 = $.sync`pwd`;
      
      $.cwd = '/tmp';
      const result2 = $.sync`pwd`;
      
      expect(result2.stdout.trim()).toBe('/tmp');
      expect(result1.stdout.trim()).not.toBe(result2.stdout.trim());
    });

    it('should support command substitution', () => {
      const hostname = $.sync`hostname`;
      const result = $.sync`echo "Running on ${hostname}"`;
      
      expect(result.stdout).toContain('Running on');
      expect(result.stdout).toContain(hostname.stdout.trim());
    });

    it('should handle special characters in arguments', () => {
      const special = 'test$`"\'\\';
      const result = $.sync`echo ${special}`;
      
      expect(result.stdout.trim()).toBe(special);
    });

    it('should capture stderr', () => {
      const result = $.sync({ nothrow: true })`echo "error" >&2; echo "output"`;
      
      expect(result.stdout).toBe('output\n');
      expect(result.stderr).toBe('error\n');
    });

    it('should work with multiline commands', () => {
      const result = $.sync`
        echo "line1"
        echo "line2"
      `;
      
      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
    });

    it('should support arrays in template literals', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = $.sync`echo ${items}`;
      
      expect(result.stdout).toBe('item1 item2 item3\n');
    });
  });

  describe('$.sync with options', () => {
    it('should create a new sync shell with options', () => {
      const syncShell = $.sync({ 
        cwd: '/tmp',
        env: { CUSTOM: 'value' }
      });
      
      const result = syncShell`pwd`;
      expect(result.stdout.trim()).toBe('/tmp');
      
      const envResult = syncShell`echo $CUSTOM`;
      expect(envResult.stdout.trim()).toBe('value');
    });

    it('should inherit options from parent shell', () => {
      $.env.PARENT_VAR = 'parent_value';
      
      const syncShell = $.sync({ quiet: true });
      const result = syncShell`echo $PARENT_VAR`;
      
      expect(result.stdout).toBe('parent_value\n');
      
      delete $.env.PARENT_VAR;
    });

    it('should support verbose option', () => {
      const syncShell = $.sync({ verbose: true });
      // Verbose mode would log commands to console
      const result = syncShell`echo "verbose sync"`;
      
      expect(result.stdout).toBe('verbose sync\n');
    });

    it('should support timeout option', () => {
      const syncShell = $.sync({ 
        timeout: 100,
        nothrow: true 
      });
      
      const result = syncShell`sleep 2`;
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('ProcessOutput interface for sync', () => {
    it('should provide all ProcessOutput methods', () => {
      const result = $.sync`echo "test output"`;
      
      expect(result.toString()).toBe('test output');
      expect(result.text()).toBe('test output');
      expect(result.stdout).toBe('test output\n');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should support json() for sync results', () => {
      const result = $.sync`echo '{"sync": true}'`;
      
      expect(result.json()).toEqual({ sync: true });
    });

    it('should support lines() for sync results', () => {
      const result = $.sync`echo -e "a\nb\nc"`;
      
      expect(result.lines()).toEqual(['a', 'b', 'c']);
    });

    it('should iterate over lines', () => {
      const result = $.sync`echo -e "line1\nline2\nline3"`;
      const lines = [];
      
      for (const line of result) {
        lines.push(line);
      }
      
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });
  });

  describe('Error handling in sync mode', () => {
    it('should throw ProcessOutput on error', () => {
      try {
        $.sync`exit 42`;
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessOutput);
        expect((error as ProcessOutput).exitCode).toBe(42);
      }
    });

    it('should include command in error', () => {
      try {
        $.sync`false`;
      } catch (error) {
        expect((error as ProcessOutput).command).toBe('false');
      }
    });

    it('should handle command not found', () => {
      const result = $.sync({ nothrow: true })`command-does-not-exist`;
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('command-does-not-exist');
    });
  });
});