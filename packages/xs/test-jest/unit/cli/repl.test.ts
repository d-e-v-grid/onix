import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { join } from 'path';

const cliPath = join(process.cwd(), 'build/cli.js');

describe('CLI REPL functionality', () => {
  describe('REPL mode', () => {
    it('should start REPL with --repl flag', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('await $`echo f"o"o`\n');
      promise.stdin.write('"b"+"ar"\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('foo');
      expect(result.stdout).toContain('bar');
      expect(result.exitCode).toBe(0);
    });

    it('should start REPL with verbosity off', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('"verbose" + " is " + $.verbose\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('verbose is false');
      expect(result.exitCode).toBe(0);
    });

    it('should handle errors in REPL', async () => {
      const promise = $`node ${cliPath} --repl`.nothrow();
      
      promise.stdin.write('throw new Error("REPL error")\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stderr).toContain('REPL error');
    });

    it('should have access to $ in REPL', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('typeof $ === "function"\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('true');
      expect(result.exitCode).toBe(0);
    });

    it('should evaluate expressions in REPL', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('2 + 2\n');
      promise.stdin.write('Math.PI\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('4');
      expect(result.stdout).toContain('3.14');
      expect(result.exitCode).toBe(0);
    });

    it('should handle async operations in REPL', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('await Promise.resolve("async result")\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('async result');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('REPL with environment options', () => {
    it('should respect --quiet in REPL mode', async () => {
      const promise = $`node ${cliPath} --quiet --repl`;
      
      promise.stdin.write('await $`echo test`\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).not.toContain('$ echo test');
      expect(result.stdout).toContain('test');
      expect(result.exitCode).toBe(0);
    });

    it('should respect --verbose in REPL mode', async () => {
      const promise = $`node ${cliPath} --verbose --repl`;
      
      promise.stdin.write('$.verbose\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('true');
      expect(result.exitCode).toBe(0);
    });

    it('should respect --cwd in REPL mode', async () => {
      const promise = $`node ${cliPath} --cwd /tmp --repl`;
      
      promise.stdin.write('await $`pwd`\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('/tmp');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('REPL special features', () => {
    it('should support require in REPL', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('require("path").sep\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toMatch(/[/\\]/);
      expect(result.exitCode).toBe(0);
    });

    it('should have access to global utilities', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('typeof cd === "function"\n');
      promise.stdin.write('typeof fetch === "function"\n');
      promise.stdin.write('typeof fs === "object"\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout.match(/true/g)).toHaveLength(3);
      expect(result.exitCode).toBe(0);
    });

    it('should handle multiline input', async () => {
      const promise = $`node ${cliPath} --repl`;
      
      promise.stdin.write('const multi = {\n');
      promise.stdin.write('  value: 42\n');
      promise.stdin.write('}\n');
      promise.stdin.write('multi.value\n');
      promise.stdin.end();
      
      const result = await promise;
      
      expect(result.stdout).toContain('42');
      expect(result.exitCode).toBe(0);
    });
  });
});