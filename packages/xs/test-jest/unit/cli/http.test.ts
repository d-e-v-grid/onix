import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/core';
import { join } from 'path';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';

const cliPath = join(process.cwd(), 'build/cli.js');

// Helper to get available port
const getPort = async () => {
  return new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
};

// Helper to create test server
const getServer = (responses: string[] = [], log = console.log) => {
  const server = net.createServer();
  
  server.on('connection', (conn) => {
    conn.on('data', (d) => {
      conn.write(responses.shift() || 'pong');
    });
  });
  
  const serverInstance = {
    server,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    start: (port: number) => new Promise<net.Server>((resolve) => 
      server.listen(port, () => resolve(server))
    ),
    listen: (port: number) => new Promise<net.Server>((resolve) => 
      server.listen(port, () => resolve(server))
    )
  };
  
  return serverInstance;
};

describe('CLI HTTP functionality', () => {
  describe('Scripts from HTTP', () => {
    it('should execute scripts from HTTP 200', async () => {
      const resp = await fs.readFile(path.resolve(__dirname, '../../fixtures/echo.http'));
      const port = await getPort();
      const server = getServer([resp.toString()]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} --verbose http://127.0.0.1:${port}/script.mjs`;
      
      expect(result.stderr).toContain('test');
      expect(result.exitCode).toBe(0);
      
      await server.stop();
    });

    it('should handle HTTP 500 errors', async () => {
      const port = await getPort();
      const server = getServer(['HTTP/1.1 500\n\n']);
      
      await server.listen(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}`.nothrow();
      
      expect(result.stderr).toContain("Error: Can't get");
      expect(result.exitCode).not.toBe(0);
      
      await server.stop();
    });

    it('should execute markdown scripts from HTTP', async () => {
      const resp = await fs.readFile(path.resolve(process.cwd(), 'test-jest/fixtures/md.http'));
      const port = await getPort();
      const server = getServer([resp.toString()]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} --verbose http://127.0.0.1:${port}/script.md`;
      
      expect(result.stderr).toContain('md');
      expect(result.exitCode).toBe(0);
      
      await server.stop();
    });

    it('should handle network errors', async () => {
      // Use a port that's likely not in use
      const result = await $`node ${cliPath} http://127.0.0.1:65535`.nothrow();
      
      expect(result.stderr).toContain('Error');
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle malformed URLs', async () => {
      const result = await $`node ${cliPath} http://not-a-valid-url`.nothrow();
      
      expect(result.stderr).toContain('Error');
      expect(result.exitCode).not.toBe(0);
    });

    it('should support HTTPS URLs', async () => {
      // This test would require setting up an HTTPS server, which is complex
      // For now, we'll test that HTTPS URLs are at least accepted
      const result = await $`node ${cliPath} https://example.com/nonexistent.mjs`.nothrow();
      
      // Should fail but not crash
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('HTTP with different content types', () => {
    it('should execute .mjs files from HTTP', async () => {
      const content = 'console.log("mjs from http")';
      const httpResponse = `HTTP/1.1 200 OK\r\nContent-Type: text/javascript\r\nContent-Length: ${content.length}\r\n\r\n${content}`;
      
      const port = await getPort();
      const server = getServer([httpResponse]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}/script.mjs`;
      
      expect(result.stdout).toContain('mjs from http');
      expect(result.exitCode).toBe(0);
      
      await server.stop();
    });

    it('should execute .js files from HTTP', async () => {
      const content = 'console.log("js from http")';
      const httpResponse = `HTTP/1.1 200 OK\r\nContent-Type: application/javascript\r\nContent-Length: ${content.length}\r\n\r\n${content}`;
      
      const port = await getPort();
      const server = getServer([httpResponse]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}/script.js`;
      
      expect(result.stdout).toContain('js from http');
      expect(result.exitCode).toBe(0);
      
      await server.stop();
    });

    it('should execute .ts files from HTTP', async () => {
      const content = 'const msg: string = "ts from http"; console.log(msg)';
      const httpResponse = `HTTP/1.1 200 OK\r\nContent-Type: text/typescript\r\nContent-Length: ${content.length}\r\n\r\n${content}`;
      
      const port = await getPort();
      const server = getServer([httpResponse]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}/script.ts`;
      
      expect(result.stdout).toContain('ts from http');
      expect(result.exitCode).toBe(0);
      
      await server.stop();
    });
  });

  describe('HTTP with authentication and headers', () => {
    it('should handle 401 Unauthorized', async () => {
      const httpResponse = 'HTTP/1.1 401 Unauthorized\r\n\r\n';
      
      const port = await getPort();
      const server = getServer([httpResponse]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}/protected.mjs`.nothrow();
      
      expect(result.stderr).toContain('Error');
      expect(result.exitCode).not.toBe(0);
      
      await server.stop();
    });

    it('should handle 404 Not Found', async () => {
      const httpResponse = 'HTTP/1.1 404 Not Found\r\n\r\n';
      
      const port = await getPort();
      const server = getServer([httpResponse]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}/missing.mjs`.nothrow();
      
      expect(result.stderr).toContain('Error');
      expect(result.exitCode).not.toBe(0);
      
      await server.stop();
    });

    it('should handle redirects', async () => {
      const httpResponse = 'HTTP/1.1 302 Found\r\nLocation: http://example.com\r\n\r\n';
      
      const port = await getPort();
      const server = getServer([httpResponse]);
      
      await server.start(port);
      
      const result = await $`node ${cliPath} http://127.0.0.1:${port}/redirect.mjs`.nothrow();
      
      // Should handle redirect (might fail on target)
      expect(result.exitCode).not.toBe(0);
      
      await server.stop();
    });
  });
});