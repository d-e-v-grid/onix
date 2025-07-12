import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Writable } from 'node:stream';
import { $ } from '../../../src/index';
import { sleep, retry, spinner, expBackoff } from '../../../src/goods';
import path from 'node:path';

const root = path.resolve(process.cwd());

describe('Async utilities', () => {
  function zx(script: string) {
    return $`node ${path.join(root, 'build/cli.js')} --eval ${script}`
      .nothrow()
      .timeout(5000);
  }

  describe('sleep()', () => {
    it('should delay execution', async () => {
      const now = Date.now();
      await sleep(100);
      const elapsed = Date.now() - now;
      
      expect(elapsed).toBeGreaterThanOrEqual(99);
    });

    it('should handle zero delay', async () => {
      const now = Date.now();
      await sleep(0);
      const elapsed = Date.now() - now;
      
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle duration strings', async () => {
      const now = Date.now();
      await sleep('100ms');
      const elapsed = Date.now() - now;
      
      expect(elapsed).toBeGreaterThanOrEqual(99);
    });
  });

  describe('retry()', () => {
    it('should retry until success', async () => {
      let count = 0;
      const result = await retry(5, () => {
        count++;
        if (count < 5) throw new Error('fail');
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(count).toBe(5);
    });

    it('should work with custom delay and limit', async () => {
      const now = Date.now();
      let count = 0;
      
      try {
        await retry(3, '2ms', () => {
          count++;
          throw new Error('fail');
        });
      } catch (e: any) {
        expect(e.message).toContain('fail');
        expect(Date.now() - now).toBeGreaterThanOrEqual(4);
        expect(count).toBe(3);
      }
    });

    it('should throw undefined on count misconfiguration', async () => {
      try {
        await retry(0, () => 'ok');
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it('should throw error on empty callback', async () => {
      try {
        // @ts-ignore
        await retry(5);
      } catch (e: any) {
        expect(e.message).toContain('Callback is required for retry');
      }
    });

    it('should support expBackoff', async () => {
      let attempts = 0;
      const result = await retry(5, expBackoff('10ms'), () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should retry with ProcessOutput errors', async () => {
      const now = Date.now();
      const script = `
        try {
          await retry(5, '50ms', () => $\`exit 123\`)
        } catch (e) {
          echo('exitCode:', e.exitCode)
        }
        await retry(5, () => $\`exit 0\`)
        echo('success')
      `;
      
      const result = await zx(script);
      
      expect(result.toString()).toContain('exitCode: 123');
      expect(result.toString()).toContain('success');
      expect(Date.now() - now).toBeGreaterThanOrEqual(50 * (5 - 1));
    });

    it('should work with expBackoff in integration', async () => {
      const now = Date.now();
      const script = `
        try {
          await retry(5, expBackoff('60s', 0), () => $\`exit 123\`)
        } catch (e) {
          echo('exitCode:', e.exitCode)
        }
        echo('success')
      `;
      
      const result = await zx(script);
      
      expect(result.toString()).toContain('exitCode: 123');
      expect(result.toString()).toContain('success');
      expect(Date.now() - now).toBeGreaterThanOrEqual(2 + 4 + 8 + 16 + 32);
    });
  });

  describe('expBackoff()', () => {
    it('should generate exponential delays', () => {
      const g = expBackoff('10s', '100ms');

      const a = g.next().value as number;
      const b = g.next().value as number;
      const c = g.next().value as number;

      expect(a).toBe(100);
      expect(b).toBe(200);
      expect(c).toBe(400);
    });

    it('should respect max delay', () => {
      const g = expBackoff('100ms', '10ms');
      
      let prev = 0;
      for (let i = 0; i < 10; i++) {
        const delay = g.next().value as number;
        expect(delay).toBeLessThanOrEqual(100);
        expect(delay).toBeGreaterThanOrEqual(prev);
        prev = delay;
      }
    });

    it('should handle default values', () => {
      const g = expBackoff();
      const firstDelay = g.next().value as number;
      
      expect(firstDelay).toBeGreaterThan(0);
    });
  });

  describe('spinner()', () => {
    it('should show spinner during async operation', async () => {
      let contents = '';
      const { CI } = process.env;
      const output = new Writable({
        write(chunk, encoding, next) {
          contents += chunk.toString();
          next();
        },
      });

      delete process.env.CI;
      const originalOutput = $.log.output;
      $.log.output = output as NodeJS.WriteStream;

      const result = await spinner(() => sleep(100));

      $.log.output = originalOutput;
      process.env.CI = CI;

      expect(contents).toContain('⠋');
    });

    it('should work with title', async () => {
      const script = `
        process.env.CI = ''
        await spinner('processing', () => sleep(100))
      `;
      
      const result = await zx(script);
      expect(result.stderr).toContain('processing');
    });

    it('should be disabled in CI', async () => {
      const script = `
        process.env.CI = 'true'
        await spinner('processing', () => sleep(100))
      `;
      
      const result = await zx(script);
      expect(result.stderr).not.toContain('processing');
    });

    it('should stop on error', async () => {
      const script = `
        await spinner('processing', () => $\`wtf-cmd\`)
      `;
      
      const result = await zx(script);
      expect(result.stderr).toContain('Error:');
      expect(result.exitCode).not.toBe(0);
    });

    it('should return the result of callback', async () => {
      const script = `
        process.env.CI = ''
        echo(await spinner(async () => {
          await sleep(100)
          await $\`echo hidden\`
          return $\`echo result\`
        }))
      `;
      
      const result = await zx(script);
      expect(result.stdout).toContain('result');
      expect(result.stderr).toContain('⠋');
      expect(result.stderr).not.toContain('result');
      expect(result.stderr).not.toContain('hidden');
    });
  });
});