import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { ProcessOutput } from '@onix-js/uxec';
import { Readable, Writable } from 'stream';

describe('ProcessPromise', () => {
  let originalQuiet: boolean;
  let originalVerbose: boolean;
  let originalNothrow: boolean;

  beforeEach(() => {
    originalQuiet = $.quiet;
    originalVerbose = $.verbose;
    originalNothrow = $.nothrow;
  });

  afterEach(() => {
    $.quiet = originalQuiet;
    $.verbose = originalVerbose;
    $.nothrow = originalNothrow;
  });

  describe('Method chaining', () => {
    it('should support nothrow()', async () => {
      const result = await $`exit 1`.nothrow();
      
      expect(result.exitCode).toBe(1);
      expect(result).toBeInstanceOf(ProcessOutput);
    });

    it('should support quiet()', async () => {
      const result = await $`echo "quiet test"`.quiet();
      
      expect(result.stdout).toBe('quiet test\n');
    });

    it('should support verbose()', async () => {
      const result = await $`echo "verbose test"`.verbose();
      
      expect(result.stdout).toBe('verbose test\n');
    });

    it('should support timeout()', async () => {
      await expect(
        $`sleep 2`.timeout(100)
      ).rejects.toThrow();
    });

    it('should chain multiple methods', async () => {
      const result = await $`exit 1`.nothrow().quiet();
      
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Stream access', () => {
    it('should provide stdin stream', async () => {
      const promise = $`cat`;
      
      expect(promise.stdin).toBeInstanceOf(Writable);
      
      // Cancel the command to clean up
      await promise.nothrow();
    });

    it('should provide stdout stream', async () => {
      const promise = $`echo "test"`;
      
      expect(promise.stdout).toBeInstanceOf(Readable);
      
      await promise;
    });

    it('should provide stderr stream', async () => {
      const promise = $`echo "error" >&2`;
      
      expect(promise.stderr).toBeInstanceOf(Readable);
      
      await promise;
    });

    it('should provide exitCode promise', async () => {
      const promise = $`exit 42`.nothrow();
      
      expect(promise.exitCode).toBeInstanceOf(Promise);
      const exitCode = await promise.exitCode;
      
      expect(exitCode).toBe(42);
    });
  });

  describe('Pipe functionality', () => {
    it('should pipe to another command', async () => {
      const result = await $`echo "hello world"`.pipe($`grep world`);
      
      expect(result.stdout).toBe('hello world\n');
      expect(result.exitCode).toBe(0);
    });

    it('should pipe through multiple commands', async () => {
      const result = await $`echo "hello\nworld\ntest"`
        .pipe($`grep world`)
        .pipe($`tr 'a-z' 'A-Z'`);
      
      expect(result.stdout).toBe('WORLD\n');
    });

    it('should handle pipe errors', async () => {
      const result = await $`echo "test"`
        .pipe($`grep "nomatch"`)
        .nothrow();
      
      expect(result.exitCode).toBe(1);
    });

    it('should pipe to writable stream', async () => {
      let output = '';
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        }
      });
      
      await $`echo "stream test"`.pipe(writeStream);
      
      expect(output).toBe('stream test\n');
    });
  });

  describe('kill method', () => {
    it('should support killing long-running processes', async () => {
      const promise = $`sleep 10`.nothrow();
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await promise.kill();
      const result = await promise;
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should support custom signals', async () => {
      const promise = $`sleep 10`.nothrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await promise.kill('SIGTERM');
      const result = await promise;
      
      expect(result.signal).toBeDefined();
    });
  });

  describe('halt method', () => {
    it('should prevent command execution', async () => {
      const result = await $`echo "should not run"`.halt();
      
      expect(result.stdout).toBe('');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('ProcessOutput methods', () => {
    it('should support text() method', async () => {
      const result = await $`echo "  test  "`;
      
      expect(result.text()).toBe('test');
    });

    it('should support lines() method', async () => {
      const result = await $`echo -e "line1\nline2\nline3"`;
      
      expect(result.lines()).toEqual(['line1', 'line2', 'line3']);
    });

    it('should support json() method', async () => {
      const result = await $`echo '{"key": "value"}'`;
      
      expect(result.json()).toEqual({ key: 'value' });
    });

    it('should support buffer() method', async () => {
      const result = await $`echo "buffer test"`;
      
      expect(result.buffer()).toBeInstanceOf(Buffer);
      expect(result.buffer().toString()).toBe('buffer test\n');
    });

    it('should support blob() method', async () => {
      const result = await $`echo "blob test"`;
      const blob = result.blob();
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('Error cases', () => {
    it('should include command in error', async () => {
      try {
        await $`exit 1`;
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessOutput);
        expect((error as ProcessOutput).command).toBe('exit 1');
      }
    });

    it('should include stderr in error', async () => {
      try {
        await $`echo "error message" >&2; exit 1`;
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessOutput);
        expect((error as ProcessOutput).stderr).toBe('error message\n');
      }
    });

    it('should handle timeout errors', async () => {
      try {
        await $`sleep 2`.timeout(100);
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessOutput);
        // Timeout might result in SIGTERM signal
        expect((error as ProcessOutput).signal).toBeDefined();
      }
    });
  });
});