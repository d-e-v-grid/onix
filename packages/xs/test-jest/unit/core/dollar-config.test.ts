import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $, defaults } from '../../../src/core';
import { ProcessOutput } from '@onix-js/uxec';

describe('$ configuration', () => {
  // Store original values
  const originalDefaults = { ...defaults };
  const originalOptions = {
    verbose: $.verbose,
    quiet: $.quiet,
    shell: $.shell,
    prefix: $.prefix,
    postfix: $.postfix,
    cwd: $.cwd,
    env: { ...$.env },
    nothrow: $.nothrow,
  };

  afterEach(() => {
    // Restore original values
    Object.assign($, originalOptions);
    $.env = { ...originalOptions.env };
  });

  describe('Configuration options', () => {
    it('should have default configuration', () => {
      expect($.verbose).toBe(false);
      expect($.quiet).toBe(false);
      expect($.shell).toBe(true);
      expect($.nothrow).toBe(false);
      expect($.prefix).toBeDefined();
      expect($.cwd).toBeDefined();
      expect($.env).toBeDefined();
    });

    it('should allow changing verbose mode', async () => {
      $.verbose = true;
      
      // In verbose mode, commands would be logged
      const result = await $`echo "test"`;
      expect(result.stdout).toBe('test\n');
      
      $.verbose = false;
    });

    it('should allow changing quiet mode', async () => {
      $.quiet = true;
      
      const result = await $`echo "quiet test"`;
      expect(result.stdout).toBe('quiet test\n');
      
      $.quiet = false;
    });

    it('should allow changing shell', async () => {
      const originalShell = $.shell;
      
      // Test with bash explicitly
      $.shell = '/bin/bash';
      const bashResult = await $`echo $0`;
      expect(bashResult.stdout).toContain('bash');
      
      // Test with sh
      $.shell = '/bin/sh';
      const shResult = await $`echo $0`;
      expect(shResult.stdout).toContain('sh');
      
      $.shell = originalShell;
    });

    it('should allow disabling shell', async () => {
      $.shell = false;
      
      // When shell is false, command is executed directly
      const result = await $`echo test`;
      expect(result.stdout).toBe('test\n');
      
      $.shell = true;
    });

    it('should allow changing prefix', async () => {
      const originalPrefix = $.prefix;
      
      // Remove safety prefix
      $.prefix = '';
      
      // This would normally fail with default prefix "set -euo pipefail"
      const result = await $`undefined_var || echo "fallback"`.nothrow();
      expect(result.stdout).toContain('fallback');
      
      $.prefix = originalPrefix;
    });

    it('should allow changing postfix', async () => {
      const originalPostfix = $.postfix;
      
      $.postfix = '; echo "postfix executed"';
      const result = await $`echo "main"`;
      
      expect(result.stdout).toContain('main');
      expect(result.stdout).toContain('postfix executed');
      
      $.postfix = originalPostfix;
    });

    it('should allow changing nothrow globally', async () => {
      $.nothrow = true;
      
      const result = await $`exit 1`;
      expect(result.exitCode).toBe(1);
      
      $.nothrow = false;
    });
  });

  describe('$ as a function with options', () => {
    it('should create new shell with custom options', async () => {
      const customShell = $({ 
        verbose: true,
        cwd: '/tmp',
        env: { CUSTOM: 'value' }
      });
      
      const result = await customShell`pwd`;
      expect(result.stdout.trim()).toBe('/tmp');
      
      const envResult = await customShell`echo $CUSTOM`;
      expect(envResult.stdout.trim()).toBe('value');
    });

    it('should inherit parent options', async () => {
      $.env.PARENT = 'parent_value';
      
      const customShell = $({ quiet: true });
      const result = await customShell`echo $PARENT`;
      
      expect(result.stdout).toBe('parent_value\n');
      
      delete $.env.PARENT;
    });

    it('should not affect global $ options', async () => {
      const originalVerbose = $.verbose;
      
      const customShell = $({ verbose: true });
      await customShell`echo "custom"`;
      
      expect($.verbose).toBe(originalVerbose);
    });

    it('should support chaining with custom shells', async () => {
      const customShell = $({ nothrow: true });
      
      const result = await customShell`exit 1`;
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Shell detection and configuration', () => {
    it('should support PowerShell', async () => {
      if (process.platform !== 'win32') {
        // Skip on non-Windows
        return;
      }
      
      $.shell = 'powershell.exe';
      const result = await $`Write-Output "PowerShell test"`;
      expect(result.stdout).toContain('PowerShell test');
    });

    it('should support custom shell paths', async () => {
      const shells = ['/bin/bash', '/bin/sh', '/usr/bin/zsh'];
      
      for (const shell of shells) {
        try {
          $.shell = shell;
          const result = await $`echo "test"`.nothrow();
          if (result.exitCode === 0) {
            expect(result.stdout).toBe('test\n');
            break;
          }
        } catch {
          // Shell might not be available
        }
      }
    });
  });

  describe('Quote function configuration', () => {
    it('should use quote function for escaping', async () => {
      const dangerous = '; rm -rf /';
      const result = await $`echo ${dangerous}`;
      
      expect(result.stdout.trim()).toBe(dangerous);
    });

    it('should allow custom quote function', async () => {
      const originalQuote = $.quote;
      
      // Custom quote that wraps in brackets
      $.quote = (arg: string) => `[${arg}]`;
      
      const result = await $`echo ${'test'}`;
      expect(result.stdout).toBe('[test]\n');
      
      $.quote = originalQuote;
    });
  });

  describe('Environment manipulation', () => {
    it('should allow adding environment variables', async () => {
      $.env.NEW_VAR = 'new_value';
      const result = await $`echo $NEW_VAR`;
      
      expect(result.stdout).toBe('new_value\n');
      
      delete $.env.NEW_VAR;
    });

    it('should allow modifying PATH', async () => {
      const originalPath = $.env.PATH;
      $.env.PATH = `/custom/bin:${originalPath}`;
      
      const result = await $`echo $PATH`;
      expect(result.stdout).toContain('/custom/bin');
      
      $.env.PATH = originalPath;
    });

    it('should inherit process.env changes', async () => {
      process.env.PROCESS_TEST = 'process_value';
      
      const result = await $`echo $PROCESS_TEST`;
      expect(result.stdout).toBe('process_value\n');
      
      delete process.env.PROCESS_TEST;
    });
  });
});