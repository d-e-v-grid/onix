import { describe, it, expect } from '@jest/globals';
import { resolveDefaults } from '../../../src/core';

describe('resolveDefaults', () => {
  describe('Environment variable processing', () => {
    it('should override known (allowed) opts from environment', () => {
      const defaults = resolveDefaults({ verbose: false }, 'ZX_', {
        ZX_VERBOSE: 'true',
        ZX_PREFER_LOCAL: '/foo/bar/',
      } as any);
      
      expect(defaults.verbose).toBe(true);
      expect(defaults.preferLocal).toBe('/foo/bar/');
    });

    it('should ignore unknown environment variables', () => {
      const defaults = resolveDefaults({}, 'ZX_', {
        ZX_INPUT: 'input',
        ZX_FOO: 'test',
      } as any);
      
      expect(defaults.input).toBeUndefined();
      expect((defaults as any).foo).toBeUndefined();
    });

    it('should parse duration values correctly', () => {
      const defaults = resolveDefaults({}, 'ZX_', {
        ZX_TIMEOUT: '10s',
      } as any);
      
      expect(defaults.timeout).toBe(10000);
    });

    it('should parse boolean values correctly', () => {
      const defaults = resolveDefaults({}, 'ZX_', {
        ZX_VERBOSE: 'true',
        ZX_QUIET: 'false',
        ZX_PREFER_LOCAL: 'true',
        ZX_DETACHED: 'false',
      } as any);
      
      expect(defaults.verbose).toBe(true);
      expect(defaults.quiet).toBe(false);
      expect(defaults.preferLocal).toBe(true);
      expect(defaults.detached).toBe(false);
    });

    it('should handle invalid values gracefully', () => {
      expect(() => resolveDefaults({}, 'ZX_', {
        ZX_TIMEOUT: 'invalid',
      } as any)).toThrow('ZX: Unable to parse env $ZX_TIMEOUT="invalid": Error: Unknown duration: "invalid".');
    });

    it('should preserve other options when processing env vars', () => {
      const defaults = resolveDefaults({
        shell: '/bin/bash',
        prefix: 'set -e',
      }, 'ZX_', {
        ZX_VERBOSE: 'true',
      } as any);
      
      expect(defaults.shell).toBe('/bin/bash');
      expect(defaults.prefix).toBe('set -e');
      expect(defaults.verbose).toBe(true);
    });
  });

  describe('Environment inheritance', () => {
    it('should inherit process.env by default', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const defaults = resolveDefaults({});
      
      expect(defaults.env.NODE_ENV).toBe('test');
      
      // Cleanup
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('should merge provided env with process.env', () => {
      const defaults = resolveDefaults({
        env: { CUSTOM_VAR: 'custom_value' },
      });
      
      expect(defaults.env.CUSTOM_VAR).toBe('custom_value');
      expect(defaults.env.PATH).toBeDefined(); // From process.env
    });

    it('should override process.env values with provided values', () => {
      const originalPath = process.env.PATH;
      
      const defaults = resolveDefaults({
        env: { PATH: '/custom/path' },
      });
      
      expect(defaults.env.PATH).toBe('/custom/path');
      expect(process.env.PATH).toBe(originalPath); // Original not modified
    });
  });
});