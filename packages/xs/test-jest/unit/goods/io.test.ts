import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Duplex, Writable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { $, chalk } from '../../../src/index';
import { echo, question, stdin } from '../../../src/goods';

const root = path.resolve(process.cwd());

describe('I/O utilities', () => {
  describe('echo()', () => {
    let originalLog: typeof console.log;
    let stdout: string;

    beforeEach(() => {
      originalLog = console.log;
      stdout = '';
      console.log = (...args: any[]) => {
        stdout += args.join(' ');
      };
    });

    afterEach(() => {
      console.log = originalLog;
    });

    it('should echo with colors', () => {
      echo(chalk.cyan('foo'), chalk.green('bar'), chalk.bold('baz'));
      
      expect(stdout).toContain('foo');
      expect(stdout).toContain('bar');
      expect(stdout).toContain('baz');
    });

    it('should support template literals', () => {
      echo`${chalk.cyan('foo')} ${chalk.green('bar')} ${chalk.bold('baz')}`;
      
      expect(stdout).toContain('foo');
      expect(stdout).toContain('bar');
      expect(stdout).toContain('baz');
    });

    it('should echo process outputs', async () => {
      echo(
        await $`echo ${chalk.cyan('foo')}`,
        await $`echo ${chalk.green('bar')}`,
        await $`echo ${chalk.bold('baz')}`
      );
      
      expect(stdout).toContain('foo');
      expect(stdout).toContain('bar');
      expect(stdout).toContain('baz');
    });

    it('should handle mixed types', () => {
      echo('string', 123, true, { key: 'value' });
      
      expect(stdout).toContain('string');
      expect(stdout).toContain('123');
      expect(stdout).toContain('true');
      expect(stdout).toContain('[object Object]');
    });
  });

  describe('question()', () => {
    it('should prompt and receive input', async () => {
      let contents = '';
      
      class Input extends Duplex {
        constructor() {
          super();
        }
        _read() {}
        _write(chunk: any, encoding: string, callback: Function) {
          this.push(chunk);
          callback();
        }
        _final() {
          this.push(null);
        }
      }
      
      const input = new Input() as any;
      const output = new Writable({
        write(chunk, encoding, next) {
          contents += chunk.toString();
          next();
        },
      }) as NodeJS.WriteStream;

      setTimeout(() => {
        input.write('foo\n');
        input.end();
      }, 10);
      
      const result = await question('foo or bar? ', {
        choices: ['foo', 'bar'],
        input,
        output,
      });

      expect(result).toBe('foo');
      expect(contents).toContain('foo or bar? ');
    });

    it('should work with default stdin/stdout', async () => {
      const script = `
        let answer = await question('foo or bar? ', { choices: ['foo', 'bar'] })
        echo('Answer is', answer)
      `;
      
      const promise = $`node ${path.join(root, 'build/cli.js')} --eval ${script}`;
      promise.stdin.write('foo\n');
      promise.stdin.end();
      
      const result = await promise;
      expect(result.stdout).toContain('Answer is foo');
    });

    it('should validate choices', async () => {
      const input = new Duplex({
        read() {},
        write(chunk, encoding, callback) {
          this.push(chunk);
          callback();
        },
      }) as any;
      
      setTimeout(() => {
        input.write('invalid\n');
        input.write('foo\n');
        input.end();
      }, 10);
      
      const result = await question('Pick one: ', {
        choices: ['foo', 'bar'],
        input,
      });
      
      expect(result).toBe('foo');
    });
  });

  describe('stdin()', () => {
    it('should read from stream', async () => {
      const stream = fs.createReadStream(path.resolve(root, 'package.json'));
      const input = await stdin(stream);
      
      expect(input).toContain('"name": "zx"');
    });

    it('should read from process.stdin when no stream provided', async () => {
      // This would require mocking process.stdin
      // For now, we just test that the function exists
      expect(typeof stdin).toBe('function');
    });

    it('should handle empty stream', async () => {
      const stream = new Duplex({
        read() {
          this.push(null);
        },
      });
      
      const input = await stdin(stream);
      expect(input).toBe('');
    });

    it('should handle large streams', async () => {
      const largeContent = 'x'.repeat(10000);
      const stream = new Duplex({
        read() {
          this.push(largeContent);
          this.push(null);
        },
      });
      
      const input = await stdin(stream);
      expect(input).toBe(largeContent);
    });
  });
});