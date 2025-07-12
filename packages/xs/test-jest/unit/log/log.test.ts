import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { log, formatCmd } from '../../../src/log';

describe('Log utilities', () => {
  describe('log()', () => {
    let data: string[];
    let stream: NodeJS.WriteStream;
    let originalOutput: NodeJS.WriteStream | undefined;
    let originalFormatters: any;

    beforeAll(() => {
      data = [];
      stream = {
        write(s: string) {
          data.push(s);
          return true;
        },
      } as NodeJS.WriteStream;
      
      originalOutput = log.output;
      originalFormatters = log.formatters;
      log.output = stream;
    });

    afterAll(() => {
      log.output = originalOutput;
      log.formatters = originalFormatters;
    });

    beforeEach(() => {
      data.length = 0;
    });

    it('should not log when verbose is false', () => {
      log({
        kind: 'cmd',
        cmd: 'echo hi',
        id: '1',
        verbose: false,
      });
      
      expect(data.join('')).toBe('');
    });

    it('should log cmd with verbose', () => {
      log({
        kind: 'cmd',
        cmd: 'echo hi',
        id: '1',
        verbose: true,
      });
      
      expect(data.join('')).toBe('$ \x1B[92mecho\x1B[39m hi\n');
    });

    it('should log stdout', () => {
      log({
        kind: 'stdout',
        data: Buffer.from('foo'),
        id: '1',
        verbose: true,
      });
      
      expect(data.join('')).toBe('foo');
    });

    it('should log stderr', () => {
      log({
        kind: 'stderr',
        data: Buffer.from('error message'),
        id: '1',
        verbose: true,
      });
      
      expect(data.join('')).toBe('error message');
    });

    it('should log cd command', () => {
      log({
        kind: 'cd',
        dir: '/tmp',
        verbose: true,
      });
      
      expect(data.join('')).toBe('$ \x1B[92mcd\x1B[39m /tmp\n');
    });

    it('should log fetch command', () => {
      log({
        kind: 'fetch',
        url: 'https://example.com',
        init: { method: 'GET' },
        verbose: true,
      });
      
      expect(data.join('')).toBe(
        "$ \x1B[92mfetch\x1B[39m https://example.com { method: 'GET' }\n"
      );
    });

    it('should log retry attempt', () => {
      log({
        kind: 'retry',
        attempt: 1,
        total: 3,
        delay: 1000,
        exception: new Error('foo'),
        error: 'bar',
        verbose: true,
      });
      
      expect(data.join('')).toBe(
        '\x1B[41m\x1B[37m FAIL \x1B[39m\x1B[49m Attempt: 1/3; next in 1000ms\n'
      );
    });

    it('should support custom formatters', () => {
      log.formatters = {
        cmd: ({ cmd }: any) => `CMD: ${cmd}`,
      };

      log({
        kind: 'cmd',
        cmd: 'echo hi',
        id: '1',
        verbose: true,
      });
      
      expect(data.join('')).toBe('CMD: echo hi');
      
      // Reset formatters
      log.formatters = {};
    });

    it('should use default formatters when custom not provided', () => {
      log.formatters = {
        cd: ({ dir }: any) => `CUSTOM CD: ${dir}\n`,
      };

      // This should use default cmd formatter
      log({
        kind: 'cmd',
        cmd: 'echo test',
        id: '1',
        verbose: true,
      });
      
      expect(data.join('')).toBe('$ \x1B[92mecho\x1B[39m test\n');
      
      // This should use custom cd formatter
      data.length = 0;
      log({
        kind: 'cd',
        dir: '/home',
        verbose: true,
      });
      
      expect(data.join('')).toBe('CUSTOM CD: /home\n');
      
      // Reset formatters
      log.formatters = {};
    });

    it('should handle unknown log kinds', () => {
      log({
        kind: 'custom',
        data: { kind: 'unknown' },
        verbose: true,
      });
      
      expect(data.join('')).toBe('');
    });

    it('should handle buffer data for stdout/stderr', () => {
      const buffer = Buffer.from('Test\nMultiline\nOutput\n');
      
      log({
        kind: 'stdout',
        data: buffer,
        id: '1',
        verbose: true,
      });
      
      expect(data.join('')).toBe('Test\nMultiline\nOutput\n');
    });
  });

  describe('formatCmd()', () => {
    it('should format simple commands', () => {
      expect(formatCmd(`echo $'hi'`)).toBe(
        "$ \x1B[92mecho\x1B[39m \x1B[93m$\x1B[39m\x1B[93m'hi'\x1B[39m\n"
      );
    });

    it('should format variables', () => {
      expect(formatCmd(`echo$foo`)).toBe(
        '$ \x1B[92mecho\x1B[39m\x1B[93m$\x1B[39mfoo\n'
      );
    });

    it('should format options', () => {
      expect(formatCmd(`test --foo=bar p1 p2`)).toBe(
        '$ \x1B[92mtest\x1B[39m --foo\x1B[31m=\x1B[39mbar p1 p2\n'
      );
    });

    it('should format pipes', () => {
      expect(formatCmd(`cmd1 --foo || cmd2`)).toBe(
        '$ \x1B[92mcmd1\x1B[39m --foo \x1B[31m|\x1B[39m\x1B[31m|\x1B[39m\x1B[92m cmd2\x1B[39m\n'
      );
    });

    it('should format environment variables', () => {
      expect(formatCmd(`A=B C='D' cmd`)).toBe(
        "$ A\x1B[31m=\x1B[39mB C\x1B[31m=\x1B[39m\x1B[93m'D'\x1B[39m\x1B[92m cmd\x1B[39m\n"
      );
    });

    it('should format complex commands', () => {
      expect(formatCmd(`foo-extra --baz = b-a-z --bar = 'b-a-r' -q -u x`)).toBe(
        "$ \x1B[92mfoo-extra\x1B[39m --baz \x1B[31m=\x1B[39m b-a-z --bar \x1B[31m=\x1B[39m \x1B[93m'b-a-r'\x1B[39m -q -u x\n"
      );
    });

    it('should format control structures', () => {
      expect(formatCmd(`while true; do "$" done`)).toBe(
        '$ \x1B[96mwhile\x1B[39m true\x1B[31m;\x1B[39m\x1B[96m do\x1B[39m \x1B[93m"$"\x1B[39m\x1B[96m done\x1B[39m\n'
      );
    });

    it('should format multiline strings', () => {
      expect(formatCmd(`echo '\n str\n'`)).toBe(
        "$ \x1B[92mecho\x1B[39m \x1B[93m'\x1B[39m\x1B[0m\x1B[0m\n\x1B[0m> \x1B[0m\x1B[93m str\x1B[39m\x1B[0m\x1B[0m\n\x1B[0m> \x1B[0m\x1B[93m'\x1B[39m\n"
      );
    });

    it('should format escaped quotes', () => {
      expect(formatCmd(`$'\\''`)).toBe(
        "$ \x1B[93m$\x1B[39m\x1B[93m'\\'\x1B[39m\x1B[93m'\x1B[39m\n"
      );
    });

    it('should format redirections', () => {
      expect(formatCmd('sass-compiler --style=compressed src/static/bootstrap.scss > dist/static/bootstrap-v5.3.3.min.css')).toBe(
        '$ \x1B[92msass-compiler\x1B[39m --style\x1B[31m=\x1B[39mcompressed src/static/bootstrap.scss \x1B[31m>\x1B[39m\x1B[92m dist/static/bootstrap-v5.3.3.min.css\x1B[39m\n'
      );
    });

    it('should format pipes with arithmetic', () => {
      expect(formatCmd('echo 1+2 | bc')).toBe(
        '$ \x1B[92mecho\x1B[39m 1\x1B[31m+\x1B[39m2 \x1B[31m|\x1B[39m\x1B[92m bc\x1B[39m\n'
      );
    });

    it('should format append redirections', () => {
      expect(formatCmd('echo test &>> filepath')).toBe(
        '$ \x1B[92mecho\x1B[39m test \x1B[31m&\x1B[39m\x1B[31m>\x1B[39m\x1B[31m>\x1B[39m\x1B[92m filepath\x1B[39m\n'
      );
    });

    it('should format input redirections', () => {
      expect(formatCmd('bc < filepath')).toBe(
        '$ \x1B[92mbc\x1B[39m \x1B[31m<\x1B[39m\x1B[92m filepath\x1B[39m\n'
      );
    });

    it('should format here documents', () => {
      const input = `cat << 'EOF' | tee -a filepath
line 1
line 2
EOF`;
      
      expect(formatCmd(input)).toBe(
        "$ \x1B[92mcat\x1B[39m \x1B[31m<\x1B[39m\x1B[31m<\x1B[39m \x1B[93m'EOF'\x1B[39m \x1B[31m|\x1B[39m\x1B[92m tee\x1B[39m -a filepath\x1B[0m\x1B[0m\n\x1B[0m> \x1B[0mline 1\x1B[0m\x1B[0m\n\x1B[0m> \x1B[0mline 2\x1B[96m\x1B[39m\x1B[0m\x1B[0m\n\x1B[0m> \x1B[0m\x1B[96mEOF\x1B[39m\n"
      );
    });

    it('should handle empty commands', () => {
      expect(formatCmd('')).toBe('$ \n');
    });

    it('should handle commands with only spaces', () => {
      expect(formatCmd('   ')).toBe('$    \n');
    });
  });
});