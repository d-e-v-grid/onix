import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { join } from 'path';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir, tmpfile } from '../../../src/index';

const cliPath = join(process.cwd(), 'build/cli.js');

describe('CLI advanced options', () => {
  describe('Shell configuration options', () => {
    it('should support --shell flag', async () => {
      const shell = $.shell;
      const result = await $`node ${cliPath} --verbose --shell=${shell} <<< '$\`echo \${$.shell}\`'`;
      
      expect(result.stderr).toContain(shell);
      expect(result.exitCode).toBe(0);
    });

    it('should support --prefix flag', async () => {
      const prefix = 'set -e;';
      const result = await $`node ${cliPath} --verbose --prefix=${prefix} <<< '$\`echo \${$.prefix}\`'`;
      
      expect(result.stderr).toContain(prefix);
      expect(result.exitCode).toBe(0);
    });

    it('should support --postfix flag', async () => {
      const postfix = '; exit 0';
      const result = await $`node ${cliPath} --verbose --postfix=${postfix} <<< '$\`echo \${$.postfix}\`'`;
      
      expect(result.stderr).toContain(postfix);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Environment options', () => {
    it('should support --env option', async () => {
      const envFile = tmpfile(
        '.env',
        `FOO=BAR
BAR=FOO+`
      );
      
      const script = `
        console.log((await $\`echo $FOO\`).stdout);
        console.log((await $\`echo $BAR\`).stdout)
      `;
      
      const result = await $`node ${cliPath} --env=${envFile} <<< ${script}`;
      
      expect(result.stdout).toBe('BAR\n\nFOO+\n\n');
      expect(result.exitCode).toBe(0);
      
      await fs.rm(envFile);
    });

    it('should support --env and --cwd options together', async () => {
      const envFile = tmpfile(
        '.env',
        `FOO=BAR
BAR=FOO+`
      );
      
      const dir = tmpdir();
      const script = `
        console.log((await $\`echo $FOO\`).stdout);
        console.log((await $\`echo $BAR\`).stdout)
      `;
      
      const result = await $`node ${cliPath} --cwd=${dir} --env=${envFile} <<< ${script}`;
      
      expect(result.stdout).toBe('BAR\n\nFOO+\n\n');
      expect(result.exitCode).toBe(0);
      
      await fs.rm(envFile);
      await fs.rm(dir, { recursive: true });
    });

    it('should handle errors with --env option', async () => {
      const script = `
        console.log((await $\`echo $FOO\`).stdout);
        console.log((await $\`echo $BAR\`).stdout)
      `;
      
      const result = await $`node ${cliPath} --env=./env <<< ${script}`.nothrow();
      
      expect(result.exitCode).toBe(1);
    });

    it('should parse .env file correctly', async () => {
      const envFile = tmpfile(
        '.env',
        `# Comment line
SIMPLE=value
QUOTED="quoted value"
SINGLE='single quoted'
MULTILINE="line1
line2"
EMPTY=
WITH_SPACES = spaced value
`
      );
      
      const script = `
        console.log('SIMPLE:', process.env.SIMPLE);
        console.log('QUOTED:', process.env.QUOTED);
        console.log('SINGLE:', process.env.SINGLE);
        console.log('EMPTY:', process.env.EMPTY);
        console.log('WITH_SPACES:', process.env.WITH_SPACES);
      `;
      
      const result = await $`node ${cliPath} --env=${envFile} <<< ${script}`;
      
      expect(result.stdout).toContain('SIMPLE: value');
      expect(result.stdout).toContain('QUOTED: quoted value');
      expect(result.stdout).toContain('SINGLE: single quoted');
      expect(result.stdout).toContain('EMPTY: ');
      expect(result.stdout).toContain('WITH_SPACES:  spaced value');
      
      await fs.rm(envFile);
    });
  });

  describe('Module loading options', () => {
    it('should support --prefer-local to load modules', async () => {
      const cwd = tmpdir();
      const external = tmpdir();
      
      // Create a fake module
      await fs.mkdir(path.join(external, 'node_modules/a'), { recursive: true });
      await fs.writeFile(
        path.join(external, 'node_modules/a/package.json'),
        JSON.stringify({
          name: 'a',
          version: '1.0.0',
          type: 'module',
          exports: './index.js'
        })
      );
      await fs.writeFile(
        path.join(external, 'node_modules/a/index.js'),
        'export const a = "AAA"'
      );
      
      const script = `
import {a} from 'a'
console.log(a);
`;
      
      const result = await $`node ${cliPath} --cwd=${cwd} --prefer-local=${external} --test <<< ${script}`;
      
      expect(result.stdout).toBe('AAA\n');
      expect(result.exitCode).toBe(0);
      
      await fs.rm(cwd, { recursive: true });
      await fs.rm(external, { recursive: true });
    });

    it('should handle missing modules with --prefer-local', async () => {
      const cwd = tmpdir();
      const script = `import {missing} from 'missing-module'`;
      
      const result = await $`node ${cliPath} --cwd=${cwd} --prefer-local=${cwd} <<< ${script}`.nothrow();
      
      expect(result.stderr).toContain('Cannot find module');
      expect(result.exitCode).not.toBe(0);
      
      await fs.rm(cwd, { recursive: true });
    });
  });

  describe('Stdin handling', () => {
    it('should support eval with stdin', async () => {
      const result = await $`(printf foo; sleep 0.1; printf bar) | node ${cliPath} --eval 'echo(await stdin())'`;
      
      expect(result.stdout).toBe('foobar\n');
      expect(result.exitCode).toBe(0);
    });

    it('should execute scripts from stdin', async () => {
      const result = await $`echo 'console.log("from stdin")' | node ${cliPath}`;
      
      expect(result.stdout).toContain('from stdin');
      expect(result.exitCode).toBe(0);
    });

    it('should support complex scripts from stdin', async () => {
      const script = `
        const result = await $\`echo "complex"\`;
        console.log(result.stdout.trim());
        console.log('Done');
      `;
      
      const result = await $`node ${cliPath} <<< ${script}`;
      
      expect(result.stdout).toContain('complex');
      expect(result.stdout).toContain('Done');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Exit code handling', () => {
    it('should propagate exit codes', async () => {
      const script = `process.exit(42)`;
      const result = await $`node ${cliPath} -e ${script}`.nothrow();
      
      expect(result.exitCode).toBe(42);
    });

    it('should set exit code from script', async () => {
      const scriptPath = join(__dirname, '../../fixtures/exit-code.mjs');
      const result = await $`node ${cliPath} ${scriptPath}`.nothrow();
      
      expect(result.exitCode).toBe(42);
    });

    it('should handle uncaught exceptions', async () => {
      const result1 = await $`node ${cliPath} <<<${'await $\`wtf\`'}`.nothrow();
      const result2 = await $`node ${cliPath} <<<'throw 42'`.nothrow();
      
      expect(result1.stderr).toContain('Error:');
      expect(result1.exitCode).not.toBe(0);
      
      expect(result2.stderr).toContain('42');
      expect(result2.exitCode).not.toBe(0);
    });
  });

  describe('Working directory options', () => {
    it('should support --cwd option', async () => {
      const cwd = path.resolve(process.cwd(), 'temp');
      await fs.mkdir(cwd, { recursive: true });
      
      const result = await $`node ${cliPath} --verbose --cwd=${cwd} <<< '$\`echo \${$.cwd}\`'`;
      
      expect(result.stderr.trim()).toEndWith(cwd);
      expect(result.exitCode).toBe(0);
    });

    it('should change directory for script execution', async () => {
      const result = await $`node ${cliPath} --cwd=/tmp -e 'console.log(process.cwd())'`;
      
      expect(result.stdout.trim()).toBe('/tmp');
      expect(result.exitCode).toBe(0);
    });

    it('should handle non-existent --cwd', async () => {
      const result = await $`node ${cliPath} --cwd=/nonexistent/path -e 'console.log("test")'`.nothrow();
      
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Test mode', () => {
    it('should support --test flag', async () => {
      const script = `
        import assert from 'assert';
        assert.equal(1 + 1, 2);
        console.log('Test passed');
      `;
      
      const result = await $`node ${cliPath} --test <<< ${script}`;
      
      expect(result.stdout).toContain('Test passed');
      expect(result.exitCode).toBe(0);
    });
  });
});