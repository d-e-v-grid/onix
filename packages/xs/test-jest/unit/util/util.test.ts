import fs from 'node:fs';
import path from 'node:path';
import { it, expect, describe } from '@jest/globals';

import {
  noop,
  quote,
  tempdir,
  getLast,
  isString,
  randomId,
  tempfile,
  parseBool,
  toCamelCase,
  parseDuration,
  preferLocalBin,
  isStringLiteral,
  quotePowerShell,
} from '../../../src/util';

describe('Utility functions', () => {
  describe('randomId()', () => {
    it('should generate valid random IDs', () => {
      const id = randomId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = Array.from({ length: 1000 }).map(() => randomId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(1000);
    });

    it('should generate consistent length IDs', () => {
      const id1 = randomId();
      const id2 = randomId();

      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });
  });

  describe('noop()', () => {
    it('should return undefined', () => {
      expect(noop()).toBeUndefined();
    });

    it('should ignore arguments', () => {
      // @ts-ignore
      expect(noop(1, 2, 3)).toBeUndefined();
    });
  });

  describe('isString()', () => {
    it('should return true for strings', () => {
      expect(isString('string')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString(String('test'))).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(1)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString(true)).toBe(false);
    });
  });

  describe('isStringLiteral()', () => {
    it('should return true for template literals', () => {
      const bar = 'baz';

      expect(isStringLiteral``).toBe(true);
      expect(isStringLiteral`foo`).toBe(true);
      expect(isStringLiteral`foo ${bar}`).toBe(true);
    });

    it('should return false for non-template literals', () => {
      expect(isStringLiteral('')).toBe(false);
      expect(isStringLiteral('foo')).toBe(false);
      expect(isStringLiteral(['foo'])).toBe(false);
      expect(isStringLiteral(123)).toBe(false);
      expect(isStringLiteral(null)).toBe(false);
    });

    it('should handle complex template literals', () => {
      const obj = { key: 'value' };
      const num = 42;

      expect(isStringLiteral`${obj} ${num}`).toBe(true);
      expect(isStringLiteral`multi
        line
        template`).toBe(true);
    });
  });

  describe('quote()', () => {
    it('should quote simple strings', () => {
      expect(quote('string')).toBe('string');
    });

    it('should quote empty strings', () => {
      expect(quote('')).toBe(`$''`);
    });

    it('should quote special characters', () => {
      expect(quote(`'\f\n\r\t\v\0`)).toBe(`$'\\'\\f\\n\\r\\t\\v\\0'`);
    });

    it('should handle various special cases', () => {
      expect(quote(' ')).toBe(`' '`);
      expect(quote('hello world')).toBe(`'hello world'`);
      expect(quote('$variable')).toBe(`'$variable'`);
      expect(quote('`command`')).toBe("'`command`'");
      expect(quote('"quoted"')).toBe(`'"quoted"'`);
    });

    it('should handle shell metacharacters', () => {
      expect(quote(';')).toBe(`';'`);
      expect(quote('|')).toBe(`'|'`);
      expect(quote('&')).toBe(`'&'`);
      expect(quote('<')).toBe(`'<'`);
      expect(quote('>')).toBe(`'>'`);
    });
  });

  describe('quotePowerShell()', () => {
    it('should quote simple strings', () => {
      expect(quotePowerShell('string')).toBe('string');
    });

    it('should quote strings with single quotes', () => {
      expect(quotePowerShell(`'`)).toBe(`''''`);
    });

    it('should quote empty strings', () => {
      expect(quotePowerShell('')).toBe(`''`);
    });

    it('should handle PowerShell special cases', () => {
      expect(quotePowerShell('hello world')).toBe(`'hello world'`);
      expect(quotePowerShell('$variable')).toBe(`'$variable'`);
      expect(quotePowerShell('"test"')).toBe(`'"test"'`);
    });
  });

  describe('parseDuration()', () => {
    it('should parse numeric values', () => {
      expect(parseDuration(1000)).toBe(1000);
      expect(parseDuration('100')).toBe(100);
    });

    it('should parse seconds', () => {
      expect(parseDuration('2s')).toBe(2000);
      expect(parseDuration('0.5s')).toBe(500);
    });

    it('should parse milliseconds', () => {
      expect(parseDuration('500ms')).toBe(500);
      expect(parseDuration('1500ms')).toBe(1500);
    });

    it('should parse minutes', () => {
      expect(parseDuration('2m')).toBe(120000);
      expect(parseDuration('1.5m')).toBe(90000);
    });

    it('should throw on invalid format', () => {
      expect(() => parseDuration('f2ms' as any)).toThrow();
      expect(() => parseDuration('2mss' as any)).toThrow();
      expect(() => parseDuration('invalid' as any)).toThrow();
    });

    it('should throw on invalid values', () => {
      expect(() => parseDuration(NaN)).toThrow();
      expect(() => parseDuration(-1)).toThrow();
      expect(() => parseDuration(Infinity)).toThrow();
    });

    it('should handle edge cases', () => {
      expect(parseDuration('0s')).toBe(0);
      expect(parseDuration('0ms')).toBe(0);
      expect(parseDuration('0m')).toBe(0);
    });
  });

  describe('tempdir()', () => {
    it('should create temporary directories', () => {
      const dir = tempdir();

      expect(dir).toMatch(/\/zx-/);
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);

      // Clean up
      fs.rmdirSync(dir);
    });

    it('should create named temporary directories', () => {
      const dir = tempdir('foo');

      expect(dir).toMatch(/\/foo$/);
      expect(fs.existsSync(dir)).toBe(true);

      // Clean up
      fs.rmdirSync(dir);
    });

    it('should create unique directories', () => {
      const dir1 = tempdir();
      const dir2 = tempdir();

      expect(dir1).not.toBe(dir2);

      // Clean up
      fs.rmdirSync(dir1);
      fs.rmdirSync(dir2);
    });
  });

  describe('tempfile()', () => {
    it('should create temporary files', () => {
      const file = tempfile();

      expect(file).toMatch(/\/zx-.+/);
      expect(fs.existsSync(path.dirname(file))).toBe(true);
    });

    it('should create named temporary files', () => {
      const file = tempfile('foo.txt');

      expect(file).toMatch(/\/zx-.+\/foo\.txt$/);

      // Clean up
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
      fs.rmdirSync(path.dirname(file));
    });

    it('should create files with content', () => {
      const content = 'test content';
      const file = tempfile('bar.txt', content);

      expect(file).toMatch(/\/zx-.+\/bar\.txt$/);
      expect(fs.readFileSync(file, 'utf-8')).toBe(content);

      // Clean up
      fs.unlinkSync(file);
      fs.rmdirSync(path.dirname(file));
    });

    it('should create files with specific permissions', () => {
      const file = tempfile('perm.txt', 'content', 0o600);
      const stats = fs.statSync(file);

      // Check if file is readable/writable by owner only
      expect(stats.mode & 0o777).toBe(0o600);

      // Clean up
      fs.unlinkSync(file);
      fs.rmdirSync(path.dirname(file));
    });
  });

  describe('preferLocalBin()', () => {
    it('should prepend local bin directories to PATH', () => {
      const env = {
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/usr/local/sbin',
      };

      const result = preferLocalBin(env, process.cwd());

      expect(result.PATH).toBe(
        `${process.cwd()}/node_modules/.bin:${process.cwd()}:${env.PATH}`
      );
    });

    it('should handle empty PATH', () => {
      const env = { PATH: '' };
      const result = preferLocalBin(env, '/test/dir');

      expect(result.PATH).toBe('/test/dir/node_modules/.bin:/test/dir:');
    });

    it('should handle missing PATH', () => {
      const env = {};
      const result = preferLocalBin(env, '/test/dir');

      expect(result.PATH).toBe('/test/dir/node_modules/.bin:/test/dir:');
    });

    it('should preserve other environment variables', () => {
      const env = {
        PATH: '/usr/bin',
        HOME: '/home/user',
        USER: 'testuser',
      };

      const result = preferLocalBin(env, '/test/dir');

      expect(result.HOME).toBe('/home/user');
      expect(result.USER).toBe('testuser');
    });
  });

  describe('toCamelCase()', () => {
    it('should convert uppercase to camelCase', () => {
      expect(toCamelCase('VERBOSE')).toBe('verbose');
      expect(toCamelCase('PREFER_LOCAL')).toBe('preferLocal');
      expect(toCamelCase('SOME_MORE_BIG_STR')).toBe('someMoreBigStr');
    });

    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('kebab-input-str')).toBe('kebabInputStr');
      expect(toCamelCase('foo-bar-baz')).toBe('fooBarBaz');
    });

    it('should handle mixed cases', () => {
      expect(toCamelCase('Mixed_CASE_String')).toBe('mixedCaseString');
    });

    it('should handle edge cases', () => {
      expect(toCamelCase('')).toBe('');
      expect(toCamelCase('a')).toBe('a');
      expect(toCamelCase('A')).toBe('a');
    });
  });

  describe('parseBool()', () => {
    it('should parse boolean strings', () => {
      expect(parseBool('true')).toBe(true);
      expect(parseBool('false')).toBe(false);
    });

    it('should return original value for non-boolean strings', () => {
      expect(parseBool('other')).toBe('other');
      expect(parseBool('yes')).toBe('yes');
      expect(parseBool('no')).toBe('no');
      expect(parseBool('1')).toBe('1');
      expect(parseBool('0')).toBe('0');
    });

    it('should handle case variations', () => {
      expect(parseBool('TRUE')).toBe('TRUE');
      expect(parseBool('False')).toBe('False');
    });
  });

  describe('getLast()', () => {
    it('should get last element of array', () => {
      expect(getLast([1, 2, 3])).toBe(3);
      expect(getLast(['a', 'b', 'c'])).toBe('c');
    });

    it('should return undefined for empty array', () => {
      expect(getLast([])).toBeUndefined();
    });

    it('should handle single element arrays', () => {
      expect(getLast([42])).toBe(42);
    });

    it('should handle arrays with different types', () => {
      expect(getLast([1, 'two', { three: 3 }])).toEqual({ three: 3 });
    });
  });
});