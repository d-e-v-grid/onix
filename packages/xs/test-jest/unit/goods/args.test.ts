import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { argv, parseArgv, updateArgv } from '../../../src/goods';

describe('Argument parsing utilities', () => {
  describe('parseArgv()', () => {
    it('should parse basic arguments', () => {
      const result = parseArgv([
        '--foo', 'bar',
        '-x', '3',
        'file.txt'
      ]);
      
      expect(result).toEqual({
        foo: 'bar',
        x: 3,
        _: ['file.txt']
      });
    });

    it('should parse complex arguments with options', () => {
      const result = parseArgv(
        [
          '--foo-bar', 'baz',
          '-a', '5',
          '-a', '42',
          '--aaa', 'AAA',
          '--force',
          './some.file',
          '--b1', 'true',
          '--b2', 'false',
          '--b3',
          '--b4', 'false',
          '--b5', 'true',
          '--b6', 'str'
        ],
        {
          boolean: ['force', 'b3', 'b4', 'b5', 'b6'],
          camelCase: true,
          parseBoolean: true,
          alias: { a: 'aaa' },
        },
        {
          def: 'def',
        }
      );
      
      expect(result).toEqual({
        a: [5, 42, 'AAA'],
        aaa: [5, 42, 'AAA'],
        fooBar: 'baz',
        force: true,
        _: ['./some.file', 'str'],
        b1: true,
        b2: false,
        b3: true,
        b4: false,
        b5: true,
        b6: true,
        def: 'def',
      });
    });

    it('should handle array values', () => {
      const result = parseArgv([
        '--item', 'a',
        '--item', 'b',
        '--item', 'c'
      ]);
      
      expect(result.item).toEqual(['a', 'b', 'c']);
    });

    it('should handle numeric values', () => {
      const result = parseArgv([
        '--int', '42',
        '--float', '3.14',
        '--string', '123abc'
      ]);
      
      expect(result.int).toBe(42);
      expect(result.float).toBe(3.14);
      expect(result.string).toBe('123abc');
    });

    it('should handle boolean flags', () => {
      const result = parseArgv(
        ['--yes', '--no-verbose', '--quiet'],
        { boolean: ['yes', 'verbose', 'quiet'] }
      );
      
      expect(result.yes).toBe(true);
      expect(result.verbose).toBe(false);
      expect(result.quiet).toBe(true);
    });

    it('should handle camelCase conversion', () => {
      const result = parseArgv(
        ['--foo-bar-baz', 'value'],
        { camelCase: true }
      );
      
      expect(result.fooBarBaz).toBe('value');
      expect(result['foo-bar-baz']).toBeUndefined();
    });

    it('should handle aliases', () => {
      const result = parseArgv(
        ['-v', '--version'],
        { 
          boolean: ['verbose', 'version'],
          alias: { v: 'verbose' } 
        }
      );
      
      expect(result.v).toBe(true);
      expect(result.verbose).toBe(true);
      expect(result.version).toBe(true);
    });

    it('should parse boolean strings when parseBoolean is true', () => {
      const result = parseArgv(
        ['--opt1', 'true', '--opt2', 'false'],
        { parseBoolean: true }
      );
      
      expect(result.opt1).toBe(true);
      expect(result.opt2).toBe(false);
    });

    it('should handle defaults', () => {
      const result = parseArgv(
        ['--provided', 'value'],
        {},
        {
          provided: 'default1',
          notProvided: 'default2'
        }
      );
      
      expect(result.provided).toBe('value');
      expect(result.notProvided).toBe('default2');
    });

    it('should handle empty arguments', () => {
      const result = parseArgv([]);
      
      expect(result).toEqual({ _: [] });
    });

    it('should handle only positional arguments', () => {
      const result = parseArgv(['file1.txt', 'file2.txt', 'file3.txt']);
      
      expect(result).toEqual({ _: ['file1.txt', 'file2.txt', 'file3.txt'] });
    });

    it('should handle double dash separator', () => {
      const result = parseArgv(['--option', 'value', '--', '--not-an-option']);
      
      expect(result.option).toBe('value');
      expect(result._).toContain('--not-an-option');
    });
  });

  describe('updateArgv()', () => {
    let originalArgv: any;

    beforeEach(() => {
      // Store original argv
      originalArgv = { ...argv };
      // Clear argv
      Object.keys(argv).forEach(key => delete (argv as any)[key]);
    });

    afterEach(() => {
      // Restore original argv
      Object.keys(argv).forEach(key => delete (argv as any)[key]);
      Object.assign(argv, originalArgv);
    });

    it('should update global argv object', () => {
      updateArgv(['--foo', 'bar']);
      
      expect(argv).toEqual({
        _: [],
        foo: 'bar',
      });
    });

    it('should replace existing argv values', () => {
      updateArgv(['--old', 'value']);
      expect(argv.old).toBe('value');
      
      updateArgv(['--new', 'value2']);
      expect(argv.old).toBeUndefined();
      expect(argv.new).toBe('value2');
    });

    it('should handle complex arguments', () => {
      updateArgv(['--verbose', '--input', 'file.txt', 'arg1', 'arg2']);
      
      expect(argv.verbose).toBe(true);
      expect(argv.input).toBe('file.txt');
      expect(argv._).toEqual(['arg1', 'arg2']);
    });

    it('should clear argv when called with empty array', () => {
      updateArgv(['--test', 'value']);
      expect(argv.test).toBe('value');
      
      updateArgv([]);
      expect(argv.test).toBeUndefined();
      expect(argv).toEqual({ _: [] });
    });
  });

  describe('argv integration', () => {
    it('should have default argv structure', () => {
      expect(argv).toHaveProperty('_');
      expect(Array.isArray(argv._)).toBe(true);
    });

    it('should be a plain object', () => {
      expect(Object.prototype.toString.call(argv)).toBe('[object Object]');
    });
  });
});