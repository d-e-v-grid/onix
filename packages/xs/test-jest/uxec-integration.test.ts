import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $, ProcessOutput } from '../src/index';

describe('xs with uxec backend integration', () => {
  // Store original values
  let originalVerbose: boolean;
  let originalQuiet: boolean;
  let originalCwd: string | undefined;

  beforeEach(() => {
    // Save original values
    originalVerbose = $.verbose;
    originalQuiet = $.quiet;
    originalCwd = $.cwd;
  });

  afterEach(() => {
    // Restore original values
    $.verbose = originalVerbose;
    $.quiet = originalQuiet;
    if (originalCwd) {
      $.cwd = originalCwd;
    }
  });

  describe('Basic functionality', () => {
    it('should execute simple commands', async () => {
      const result = await $`echo "Hello from uxec!"`;
      
      expect(result).toBeInstanceOf(ProcessOutput);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello from uxec!\n');
      expect(result.stderr).toBe('');
    });

    it('should handle nothrow()', async () => {
      const result = await $`exit 1`.nothrow();
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('exit code 1');
    });

    it('should handle quiet()', async () => {
      $.verbose = true; // Enable verbose to test quiet suppresses it
      const result = await $`echo "quiet test"`.quiet();
      
      expect(result.stdout).toBe('quiet test\n');
      expect(result.exitCode).toBe(0);
    });

    it('should support sync execution', () => {
      const result = $.sync`echo "sync test"`;
      
      expect(result).toBeInstanceOf(ProcessOutput);
      expect(result.stdout).toBe('sync test\n');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Environment and options', () => {
    it('should respect environment variables', async () => {
      $.env.TEST_UXEC_VAR = 'test_value';
      const result = await $`echo $TEST_UXEC_VAR`;
      
      expect(result.stdout).toBe('test_value\n');
      
      // Cleanup
      delete $.env.TEST_UXEC_VAR;
    });

    it('should handle working directory changes', async () => {
      const tempDir = '/tmp';
      $.cwd = tempDir;
      
      const result = await $`pwd`;
      expect(result.stdout.trim()).toBe(tempDir);
    });

    it('should support timeout', async () => {
      const result = await $`sleep 0.01`.timeout(1000);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('ProcessOutput methods', () => {
    it('should support text() method', async () => {
      const result = await $`echo "  trimmed  "`;
      expect(result.text()).toBe('trimmed');
    });

    it('should support lines() method', async () => {
      const result = await $`echo -e "line1\nline2\nline3"`;
      const lines = result.lines();
      
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should support toString() method', async () => {
      const result = await $`echo "test output"`;
      expect(result.toString()).toBe('test output');
    });

    it('should handle errors with proper ProcessOutput', async () => {
      try {
        await $`exit 42`;
        expect(true).toBe(false); // Should have thrown
      } catch (error) {
        expect(error).toBeInstanceOf(ProcessOutput);
        expect((error as ProcessOutput).exitCode).toBe(42);
      }
    });
  });

  describe('Template literal features', () => {
    it('should handle string interpolation', async () => {
      const name = 'uxec';
      const result = await $`echo "Hello, ${name}!"`;
      
      expect(result.stdout).toBe('Hello, uxec!\n');
    });

    it('should handle array interpolation', async () => {
      const items = ['apple', 'banana', 'cherry'];
      const result = await $`echo ${items}`;
      
      expect(result.stdout).toBe('apple banana cherry\n');
    });

    it('should properly quote special characters', async () => {
      const special = 'test$variable"with\'quotes`and\\backslash';
      const result = await $`echo ${special}`;
      
      expect(result.stdout.trim()).toBe(special);
    });
  });
});