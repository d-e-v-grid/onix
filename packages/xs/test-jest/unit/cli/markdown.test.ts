import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { join } from 'path';

const cliPath = join(process.cwd(), 'build/cli.js');

describe('CLI Markdown functionality', () => {
  describe('Markdown script execution', () => {
    it('should execute markdown scripts', async () => {
      const scriptPath = join(process.cwd(), 'test-jest/fixtures/markdown.md');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.exitCode).toBe(0);
    });

    it('should execute markdown scripts with CRLF line endings', async () => {
      const scriptPath = join(process.cwd(), 'test-jest/fixtures/markdown-crlf.md');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      expect(result.stdout).toContain('Hello, world!');
      expect(result.exitCode).toBe(0);
    });

    it('should extract and run code blocks from markdown', async () => {
      const scriptPath = join(process.cwd(), 'test-jest/fixtures/markdown.md');
      const result = await $`node ${cliPath} ${scriptPath}`;
      
      // The markdown fixture should have code that outputs something
      expect(result.stdout).toBeTruthy();
      expect(result.exitCode).toBe(0);
    });

    it('should respect --quiet flag with markdown', async () => {
      const scriptPath = join(process.cwd(), 'test-jest/fixtures/markdown.md');
      const result = await $`node ${cliPath} --quiet ${scriptPath}`;
      
      expect(result.stderr).not.toContain('ignore');
      expect(result.stderr).not.toContain('hello');
      expect(result.stdout).toContain('world');
      expect(result.exitCode).toBe(0);
    });

    it('should handle errors in markdown scripts', async () => {
      // Create a temporary markdown file with error
      const errorMd = join(process.cwd(), 'test-jest/fixtures/error.md');
      await $`echo '# Error Test\n\n\`\`\`js\nthrow new Error("Markdown error")\n\`\`\`' > ${errorMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${errorMd}`.nothrow();
      
      expect(result.stderr).toContain('Markdown error');
      expect(result.exitCode).not.toBe(0);
      
      // Clean up
      await $`rm -f ${errorMd}`.nothrow();
    });

    it('should support multiple code blocks in markdown', async () => {
      // Create a temporary markdown file with multiple blocks
      const multiMd = join(process.cwd(), 'test-jest/fixtures/multi.md');
      const content = `# Multiple Blocks

First block:
\`\`\`js
console.log('block1')
\`\`\`

Second block:
\`\`\`js
console.log('block2')
\`\`\`
`;
      
      await $`echo ${content} > ${multiMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${multiMd}`;
      
      expect(result.stdout).toContain('block1');
      expect(result.stdout).toContain('block2');
      expect(result.exitCode).toBe(0);
      
      // Clean up
      await $`rm -f ${multiMd}`.nothrow();
    });
  });

  describe('Markdown with different code fence languages', () => {
    it('should execute javascript code blocks', async () => {
      const jsMd = join(process.cwd(), 'test-jest/fixtures/js-block.md');
      const content = `# JS Test
\`\`\`javascript
console.log('javascript block')
\`\`\`
`;
      
      await $`echo ${content} > ${jsMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${jsMd}`;
      
      expect(result.stdout).toContain('javascript block');
      expect(result.exitCode).toBe(0);
      
      await $`rm -f ${jsMd}`.nothrow();
    });

    it('should execute js code blocks', async () => {
      const jsMd = join(process.cwd(), 'test-jest/fixtures/js-short.md');
      const content = `# JS Short Test
\`\`\`js
console.log('js block')
\`\`\`
`;
      
      await $`echo ${content} > ${jsMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${jsMd}`;
      
      expect(result.stdout).toContain('js block');
      expect(result.exitCode).toBe(0);
      
      await $`rm -f ${jsMd}`.nothrow();
    });

    it('should skip non-js code blocks', async () => {
      const mixedMd = join(process.cwd(), 'test-jest/fixtures/mixed.md');
      const content = `# Mixed Languages
\`\`\`python
print("python code")
\`\`\`

\`\`\`js
console.log('js code')
\`\`\`

\`\`\`bash
echo "bash code"
\`\`\`
`;
      
      await $`echo ${content} > ${mixedMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${mixedMd}`;
      
      expect(result.stdout).toContain('js code');
      expect(result.stdout).not.toContain('python code');
      expect(result.stdout).not.toContain('bash code');
      expect(result.exitCode).toBe(0);
      
      await $`rm -f ${mixedMd}`.nothrow();
    });
  });

  describe('Markdown environment integration', () => {
    it('should have access to $ in markdown', async () => {
      const dollarMd = join(process.cwd(), 'test-jest/fixtures/dollar.md');
      const content = `# Dollar Test
\`\`\`js
const result = await $\`echo "from markdown"\`
console.log(result.stdout.trim())
\`\`\`
`;
      
      await $`echo ${content} > ${dollarMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${dollarMd}`;
      
      expect(result.stdout).toContain('from markdown');
      expect(result.exitCode).toBe(0);
      
      await $`rm -f ${dollarMd}`.nothrow();
    });

    it('should have access to globals in markdown', async () => {
      const globalsMd = join(process.cwd(), 'test-jest/fixtures/globals.md');
      const content = `# Globals Test
\`\`\`js
console.log(typeof fs === 'object')
console.log(typeof cd === 'function')
console.log(typeof fetch === 'function')
\`\`\`
`;
      
      await $`echo ${content} > ${globalsMd}`.nothrow();
      
      const result = await $`node ${cliPath} ${globalsMd}`;
      
      expect(result.stdout.match(/true/g)).toHaveLength(3);
      expect(result.exitCode).toBe(0);
      
      await $`rm -f ${globalsMd}`.nothrow();
    });

    it('should respect CLI options in markdown execution', async () => {
      const optionsMd = join(process.cwd(), 'test-jest/fixtures/options.md');
      const content = `# Options Test
\`\`\`js
console.log('Verbose:', $.verbose)
await $\`pwd\`
\`\`\`
`;
      
      await $`echo ${content} > ${optionsMd}`.nothrow();
      
      const result = await $`node ${cliPath} --verbose --cwd /tmp ${optionsMd}`;
      
      expect(result.stdout).toContain('Verbose: true');
      expect(result.stdout).toContain('/tmp');
      expect(result.exitCode).toBe(0);
      
      await $`rm -f ${optionsMd}`.nothrow();
    });
  });
});