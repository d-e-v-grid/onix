import { describe, it, expect } from '@jest/globals';
import {
  getErrnoMessage,
  getExitCodeInfo,
  getCallerLocation,
  formatExitMessage,
  formatErrorMessage,
  formatErrorDetails,
  getCallerLocationFromString,
} from '../../../src/error';

describe('Error utilities', () => {
  describe('getExitCodeInfo()', () => {
    it('should return info for known exit codes', () => {
      expect(getExitCodeInfo(2)).toBe('Misuse of shell builtins');
    });

    it('should handle various exit codes', () => {
      // Common exit codes
      expect(getExitCodeInfo(0)).toBeDefined();
      expect(getExitCodeInfo(1)).toBeDefined();
      expect(getExitCodeInfo(126)).toBeDefined();
      expect(getExitCodeInfo(127)).toBeDefined();
      expect(getExitCodeInfo(130)).toBeDefined();
    });

    it('should handle unknown exit codes', () => {
      const result = getExitCodeInfo(999);
      expect(result).toBeDefined();
    });
  });

  describe('getErrnoMessage()', () => {
    it('should return message for known errno codes', () => {
      expect(getErrnoMessage(-2)).toBe('No such file or directory');
    });

    it('should return "Unknown error" for unknown codes', () => {
      expect(getErrnoMessage(1e9)).toBe('Unknown error');
    });

    it('should handle undefined input', () => {
      expect(getErrnoMessage(undefined)).toBe('Unknown error');
    });

    it('should handle common errno codes', () => {
      // EACCES
      expect(getErrnoMessage(-13)).toBeDefined();
      // EEXIST
      expect(getErrnoMessage(-17)).toBeDefined();
      // ENOTDIR
      expect(getErrnoMessage(-20)).toBeDefined();
      // EISDIR
      expect(getErrnoMessage(-21)).toBeDefined();
    });

    it('should handle zero errno', () => {
      expect(getErrnoMessage(0)).toBeDefined();
    });
  });

  describe('getCallerLocation()', () => {
    it('should extract caller location from error', () => {
      const error = new Error('Test error');
      const location = getCallerLocation(error);
      
      expect(location).toMatch(/\.test\.ts/);
    });

    it('should handle errors without stack', () => {
      const error = new Error('No stack');
      error.stack = undefined;
      
      const location = getCallerLocation(error);
      expect(location).toBeDefined();
    });

    it('should handle custom errors', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      
      const error = new CustomError('Custom');
      const location = getCallerLocation(error);
      
      expect(location).toBeTruthy();
    });
  });

  describe('getCallerLocationFromString()', () => {
    it('should return "unknown" for empty input', () => {
      expect(getCallerLocationFromString()).toBe('unknown');
    });

    it('should return input for non-matching strings', () => {
      const input = 'stack\nstring';
      expect(getCallerLocationFromString(input)).toBe(input);
    });

    it('should parse V8 stack trace format', () => {
      const stack = `
    Error
      at getCallerLocation (/Users/user/test.js:22:17)
      at Proxy.set (/Users/user/test.js:40:10)
      at e (/Users/user/test.js:34:13)
      at d (/Users/user/test.js:11:5)
      at c (/Users/user/test.js:8:5)
      at b (/Users/user/test.js:5:5)
      at a (/Users/user/test.js:2:5)
      at Object.<anonymous> (/Users/user/test.js:37:1)
      at Module._compile (node:internal/modules/cjs/loader:1254:14)
      at Module._extensions..js (node:internal/modules/cjs/loader:1308:10)
      at Module.load (node:internal/modules/cjs/loader:1117:32)
      at Module._load (node:internal/modules/cjs/loader:958:12)
    `;
      
      const result = getCallerLocationFromString(stack);
      expect(result).toMatch(/^.*:11:5.*$/);
    });

    it('should parse JSC (JavaScriptCore) stack trace format', () => {
      const stack = `
    getCallerLocation@/Users/user/test.js:22:17
    Proxy.set@/Users/user/test.js:40:10)
    e@/Users/user/test.js:34:13
    d@/Users/user/test.js:11:5
    c@/Users/user/test.js:8:5
    b@/Users/user/test.js:5:5
    a@/Users/user/test.js:2:5
    module code@/Users/user/test.js:37:1
    evaluate@[native code]
    moduleEvaluation@[native code]
    moduleEvaluation@[native code]
    @[native code]
    asyncFunctionResume@[native code]
    promiseReactionJobWithoutPromise@[native code]
    promiseReactionJob@[native code]
    d@/Users/user/test.js:11:5
  `;
      
      const result = getCallerLocationFromString(stack);
      expect(result).toMatch(/^.*:11:5.*$/);
    });

    it('should handle stack traces with Windows paths', () => {
      const stack = `
    Error
      at getCallerLocation (C:\\Users\\user\\test.js:22:17)
      at Proxy.set (C:\\Users\\user\\test.js:40:10)
      at e (C:\\Users\\user\\test.js:34:13)
      at d (C:\\Users\\user\\test.js:11:5)
    `;
      
      const result = getCallerLocationFromString(stack);
      expect(result).toContain('test.js:11:5');
    });

    it('should handle malformed stack traces', () => {
      const stack = `
    Error occurred
    Some random text
    Not a proper stack trace
    `;
      
      const result = getCallerLocationFromString(stack);
      expect(result).toBe(stack.trim());
    });
  });

  describe('formatExitMessage()', () => {
    it('should format exit code with description', () => {
      const result = formatExitMessage(2, null, '', '');
      expect(result).toContain('Misuse of shell builtins');
    });

    it('should format with signal and data', () => {
      const result = formatExitMessage(1, 'SIGKILL', '', '', 'data');
      expect(result).toBe(`\n    at \n    exit code: 1 (General error)\n    signal: SIGKILL\n    details: \ndata`);
    });

    it('should format successful exit', () => {
      const result = formatExitMessage(0, null, '', '');
      expect(result).toBe('exit code: 0');
    });

    it('should handle various signals', () => {
      const signals = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGKILL'];
      
      signals.forEach(signal => {
        const result = formatExitMessage(null, signal as NodeJS.Signals, '', '');
        expect(result).toContain(`signal: ${signal}`);
      });
    });

    it('should include command and details', () => {
      const result = formatExitMessage(1, null, 'ls -la', '/home/user', 'Permission denied');
      
      expect(result).toContain('ls -la');
      expect(result).toContain('/home/user');
      expect(result).toContain('Permission denied');
    });

    it('should handle null signal gracefully', () => {
      const result = formatExitMessage(127, null, 'command', '/path');
      
      expect(result).toContain('exit code: 127');
      expect(result).not.toContain('signal:');
    });
  });

  describe('formatErrorMessage()', () => {
    it('should format errno errors', () => {
      const error = { errno: -2 } as NodeJS.ErrnoException;
      const result = formatErrorMessage(error, '');
      
      expect(result).toContain('No such file or directory');
    });

    it('should handle unknown errno', () => {
      const error = { errno: -1e9 } as NodeJS.ErrnoException;
      const result = formatErrorMessage(error, '');
      
      expect(result).toContain('Unknown error');
    });

    it('should handle errors without errno', () => {
      const error = {} as NodeJS.ErrnoException;
      const result = formatErrorMessage(error, '');
      
      expect(result).toContain('Unknown error');
    });

    it('should include error message', () => {
      const error = {
        errno: -13,
        message: 'Permission denied',
        code: 'EACCES'
      } as NodeJS.ErrnoException;
      
      const result = formatErrorMessage(error, 'test location');
      
      expect(result).toContain('Permission denied');
      expect(result).toContain('test location');
    });

    it('should handle system errors', () => {
      const error = {
        name: 'Error',
        message: 'EADDRINUSE',
        errno: -98,
        code: 'EADDRINUSE',
        syscall: 'bind',
        port: 3000
      } as NodeJS.ErrnoException;
      
      const result = formatErrorMessage(error, '');
      expect(result).toBeTruthy();
    });
  });

  describe('formatErrorDetails()', () => {
    it('should return empty string for empty input', () => {
      expect(formatErrorDetails([])).toBe('');
    });

    it('should join a few lines', () => {
      const result = formatErrorDetails(['foo', 'bar']);
      expect(result).toBe('foo\nbar');
    });

    it('should extract error patterns', () => {
      const lines = ['failure: foo', 'NOT OK smth', ...Array(40).fill('line')];
      const result = formatErrorDetails(lines);
      
      expect(result).toBe('failure: foo\nNOT OK smth');
    });

    it('should truncate long output', () => {
      const lines = Array(40).fill(0).map((_, i) => i.toString());
      const result = formatErrorDetails(lines);
      
      expect(result).toContain('0\n1\n2');
      expect(result).toContain('...');
      expect(result.split('\n').length).toBeLessThan(lines.length);
    });

    it('should extract various error patterns', () => {
      const lines = [
        'some output',
        'Error: something went wrong',
        'more output',
        'FAIL: test failed',
        'even more output',
        'failure: critical error',
        'final output'
      ];
      
      const result = formatErrorDetails(lines);
      
      expect(result).toContain('Error: something went wrong');
      expect(result).toContain('FAIL: test failed');
      expect(result).toContain('failure: critical error');
    });

    it('should handle lines with special characters', () => {
      const lines = [
        'Error: File not found: /path/with spaces/file.txt',
        'FAIL: Command `rm -rf /` is dangerous',
        'NOT OK: Test "complex test" failed'
      ];
      
      const result = formatErrorDetails(lines);
      
      expect(result).toContain('File not found');
      expect(result).toContain('rm -rf');
      expect(result).toContain('complex test');
    });

    it('should preserve order of error lines', () => {
      const lines = [
        'Error: First',
        'normal output',
        'Error: Second',
        'more output',
        'Error: Third'
      ];
      
      const result = formatErrorDetails(lines);
      const errorLines = result.split('\n').filter(line => line.includes('Error:'));
      
      expect(errorLines).toEqual(['Error: First', 'Error: Second', 'Error: Third']);
    });
  });
});