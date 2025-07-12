import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { join } from 'path';

const cliPath = join(process.cwd(), 'build/cli.js');

describe('CLI basic functionality', () => {
  describe('Version and help', () => {
    it('should print version with -v flag', async () => {
      const result = await $`node ${cliPath} -v`;
      
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      expect(result.exitCode).toBe(0);
    });

    it('should print version with --version flag', async () => {
      const result = await $`node ${cliPath} --version`;
      
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      expect(result.exitCode).toBe(0);
    });

    it('should print help with -h flag', async () => {
      const result = await $`node ${cliPath} -h`;
      
      expect(result.stdout).toMatch(/zx/i);
      expect(result.stdout).toContain('Usage');
      expect(result.exitCode).toBe(0);
    });

    it('should print help with --help flag', async () => {
      const result = await $`node ${cliPath} --help`;
      
      expect(result.stdout).toMatch(/zx/i);
      expect(result.stdout).toContain('Usage');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Usage without parameters', () => {
    it('should print usage when no parameters are provided', async () => {
      const result = await $`node ${cliPath}`.nothrow();
      
      expect(result.stdout).toContain('A tool for writing better scripts');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Script execution', () => {
    it('should execute a simple script', async () => {
      const scriptPath = join(__dirname, '../../fixtures/echo.mjs');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should pass arguments to script', async () => {
      const scriptPath = join(__dirname, '../../fixtures/argv.mjs');
      const result = await $`node ${cliPath} ${scriptPath} arg1 arg2 arg3`;
      
      expect(result.stdout).toContain('arg1');
      expect(result.stdout).toContain('arg2');
      expect(result.stdout).toContain('arg3');
      expect(result.exitCode).toBe(0);
    });

    it('should handle script errors', async () => {
      const scriptPath = join(__dirname, '../../fixtures/exit-code.mjs');
      const result = await $`node ${cliPath} ${scriptPath}`.nothrow();
      
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Inline evaluation', () => {
    it('should evaluate inline code with -e flag', async () => {
      const result = await $`node ${cliPath} -e "console.log('evaluated')"`;
      
      expect(result.stdout).toContain('evaluated');
      expect(result.exitCode).toBe(0);
    });

    it('should evaluate inline code with --eval flag', async () => {
      const result = await $`node ${cliPath} --eval "console.log('evaluated')"`;
      
      expect(result.stdout).toContain('evaluated');
      expect(result.exitCode).toBe(0);
    });

    it('should have access to $ in eval mode', async () => {
      const result = await $`node ${cliPath} -e "await $\\\`echo test\\\`"`;
      
      expect(result.stdout).toContain('test');
      expect(result.exitCode).toBe(0);
    });

    it('should handle eval errors', async () => {
      const result = await $`node ${cliPath} -e "throw new Error('test error')"`.nothrow();
      
      expect(result.stderr).toContain('test error');
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Environment options', () => {
    it('should respect --quiet flag', async () => {
      const result = await $`node ${cliPath} --quiet -e "await $\\\`echo test\\\`"`;
      
      expect(result.stdout).not.toContain('$ echo test');
      expect(result.stdout).toContain('test');
      expect(result.exitCode).toBe(0);
    });

    it('should respect --verbose flag', async () => {
      const result = await $`node ${cliPath} --verbose -e "await $\\\`echo test\\\`"`;
      
      expect(result.stdout).toContain('$ echo test');
      expect(result.stdout).toContain('test');
      expect(result.exitCode).toBe(0);
    });

    it('should respect --shell option', async () => {
      const result = await $`node ${cliPath} --shell /bin/sh -e "await $\\\`echo $0\\\`"`;
      
      expect(result.stdout).toContain('sh');
      expect(result.exitCode).toBe(0);
    });

    it('should respect --cwd option', async () => {
      const result = await $`node ${cliPath} --cwd /tmp -e "await $\\\`pwd\\\`"`;
      
      expect(result.stdout.trim()).toContain('/tmp');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('File extension handling', () => {
    it('should execute .mjs files', async () => {
      const scriptPath = join(__dirname, '../../fixtures/echo.mjs');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should execute .js files', async () => {
      const scriptPath = join(__dirname, '../../fixtures/js-project/script.js');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should execute .ts files', async () => {
      const scriptPath = join(__dirname, '../../fixtures/ts-project/script.ts');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should execute files without extension', async () => {
      const scriptPath = join(__dirname, '../../fixtures/no-extension');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should respect --ext option', async () => {
      const scriptPath = join(__dirname, '../../fixtures/non-std-ext.zx');
      const result = await $`node ${cliPath} --ext .zx ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });
  });
});