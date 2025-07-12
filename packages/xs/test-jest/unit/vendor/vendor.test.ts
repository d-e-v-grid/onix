import { describe, it, expect } from '@jest/globals';
import {
  YAML,
  glob,
  which,
  minimist,
  nodeFetch as fetch,
} from '../../../src/vendor';

describe('Vendor API', () => {
  describe('YAML', () => {
    it('should parse YAML strings', () => {
      expect(YAML.parse('a: b\n')).toEqual({ a: 'b' });
    });

    it('should parse complex YAML', () => {
      const yaml = `
name: test
version: 1.0.0
dependencies:
  - foo
  - bar
config:
  enabled: true
  port: 8080
`;
      
      const parsed = YAML.parse(yaml);
      
      expect(parsed.name).toBe('test');
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.dependencies).toEqual(['foo', 'bar']);
      expect(parsed.config).toEqual({ enabled: true, port: 8080 });
    });

    it('should stringify objects to YAML', () => {
      expect(YAML.stringify({ a: 'b' })).toBe('a: b\n');
    });

    it('should stringify complex objects', () => {
      const obj = {
        name: 'test',
        items: ['a', 'b', 'c'],
        nested: {
          key: 'value'
        }
      };
      
      const yaml = YAML.stringify(obj);
      
      expect(yaml).toContain('name: test');
      expect(yaml).toContain('items:');
      expect(yaml).toContain('- a');
      expect(yaml).toContain('nested:');
      expect(yaml).toContain('key: value');
    });

    it('should handle empty objects', () => {
      expect(YAML.parse('{}')).toEqual({});
      expect(YAML.stringify({})).toBe('{}\n');
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3];
      const yaml = YAML.stringify(arr);
      const parsed = YAML.parse(yaml);
      
      expect(parsed).toEqual(arr);
    });
  });

  describe('glob/globby', () => {
    it('should find files with glob patterns', async () => {
      const results = await glob('*.md');
      expect(results).toContain('README.md');
    });

    it('should support synchronous globbing', () => {
      const results = glob.sync('*.md');
      expect(results).toContain('README.md');
    });

    it('should find files with complex patterns', async () => {
      const results = await glob('**/*.json');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(f => f.endsWith('.json'))).toBe(true);
    });

    it('should support multiple patterns', async () => {
      const results = await glob(['*.md', '*.json']);
      
      expect(results.some(f => f.endsWith('.md'))).toBe(true);
      expect(results.some(f => f.endsWith('.json'))).toBe(true);
    });

    it('should support negative patterns', async () => {
      const results = await glob(['**/*.js', '!**/node_modules/**']);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(f => !f.includes('node_modules'))).toBe(true);
    });

    it('should return empty array for non-matching patterns', async () => {
      const results = await glob('*.nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('fetch', () => {
    it('should fetch from URLs', async () => {
      const response = await fetch('https://example.com');
      const text = await response.text();
      
      expect(text).toContain('Example Domain');
    });

    it('should return response with status', async () => {
      const response = await fetch('https://example.com');
      
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
    });

    it('should support different methods', async () => {
      const response = await fetch('https://example.com', {
        method: 'HEAD'
      });
      
      expect(response.status).toBe(200);
    });

    it('should handle JSON responses', async () => {
      // Using a public API that returns JSON
      const response = await fetch('https://api.github.com/zen');
      const text = await response.text();
      
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('which', () => {
    it('should find executables in PATH', async () => {
      const npmPath = await which('npm');
      
      expect(typeof npmPath).toBe('string');
      expect(npmPath).toContain('npm');
    });

    it('should support synchronous lookup', () => {
      const npmPath = which.sync('npm');
      
      expect(typeof npmPath).toBe('string');
      expect(npmPath).toContain('npm');
    });

    it('should match async and sync results', async () => {
      const asyncPath = await which('npm');
      const syncPath = which.sync('npm');
      
      expect(asyncPath).toBe(syncPath);
    });

    it('should throw for non-existent commands', () => {
      expect(() => {
        which.sync('not-found-cmd-that-does-not-exist');
      }).toThrow(/not-found-cmd-that-does-not-exist/);
    });

    it('should reject for non-existent commands async', async () => {
      await expect(
        which('not-found-cmd-that-does-not-exist')
      ).rejects.toThrow(/not-found-cmd-that-does-not-exist/);
    });

    it('should find common system commands', async () => {
      // Commands that should exist on most systems
      const commands = process.platform === 'win32' 
        ? ['cmd', 'powershell']
        : ['sh', 'ls'];
      
      for (const cmd of commands) {
        const path = await which(cmd);
        expect(path).toBeTruthy();
      }
    });
  });

  describe('minimist', () => {
    it('should be a function', () => {
      expect(typeof minimist).toBe('function');
    });

    it('should parse command line arguments', () => {
      const result = minimist(
        ['--foo', 'bar', '-a', '5', '-a', '42', '--force', './some.file'],
        { boolean: 'force' }
      );
      
      expect(result).toEqual({
        a: [5, 42],
        foo: 'bar',
        force: true,
        _: ['./some.file'],
      });
    });

    it('should handle various argument types', () => {
      const result = minimist([
        '--str', 'string',
        '--num', '123',
        '--bool',
        '--no-false',
        'positional'
      ]);
      
      expect(result.str).toBe('string');
      expect(result.num).toBe(123);
      expect(result.bool).toBe(true);
      expect(result.false).toBe(false);
      expect(result._).toContain('positional');
    });

    it('should support aliases', () => {
      const result = minimist(
        ['-v', '--name', 'test'],
        { alias: { v: 'verbose', n: 'name' } }
      );
      
      expect(result.v).toBe(true);
      expect(result.verbose).toBe(true);
      expect(result.name).toBe('test');
      expect(result.n).toBe('test');
    });

    it('should support defaults', () => {
      const result = minimist(
        ['--provided', 'value'],
        { default: { provided: 'default', missing: 'default' } }
      );
      
      expect(result.provided).toBe('value');
      expect(result.missing).toBe('default');
    });

    it('should handle empty arguments', () => {
      const result = minimist([]);
      
      expect(result).toEqual({ _: [] });
    });
  });
});