import { Readable, Writable } from 'node:stream';
import { it, jest, expect, describe, beforeEach } from '@jest/globals';

// Create a mock spawn function
const mockSpawn = jest.fn();

// Mock modules using unstable_mockModule for ESM
await jest.unstable_mockModule('node:child_process', () => ({
  spawn: mockSpawn
}));

await jest.unstable_mockModule('../../../src/utils/runtime-detect.js', () => ({
  RuntimeDetector: {
    detect: jest.fn(),
    isBun: jest.fn(),
    isNode: jest.fn(),
    isDeno: jest.fn(),
    getBunVersion: jest.fn(),
    hasFeature: jest.fn(),
    reset: jest.fn()
  }
}));

// Import after mocking
const { TimeoutError } = await import('../../../src/core/error.js');
const { LocalAdapter } = await import('../../../src/adapters/local-adapter.js');
const { RuntimeDetector } = await import('../../../src/utils/runtime-detect.js');
const { MockProcess, createMockProcess } = await import('../../helpers/test-environment.js');

describe('LocalAdapter', () => {
  let adapter: InstanceType<typeof LocalAdapter>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new LocalAdapter({});
    
    // Default to Node.js runtime
    (RuntimeDetector.detect as jest.Mock).mockReturnValue('node');
    (RuntimeDetector.isBun as jest.Mock).mockReturnValue(false);
    (RuntimeDetector.isNode as jest.Mock).mockReturnValue(true);
  });
  
  describe('Availability', () => {
    it('should always be available', async () => {
      const available = await adapter.isAvailable();
      expect(available).toBe(true);
    });
  });
  
  describe('Simple command execution', () => {
    it('should execute simple commands', async () => {
      const mockProcess = createMockProcess({
        stdout: 'Hello, World!\n',
        stderr: '',
        exitCode: 0
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const result = await adapter.execute({ 
        command: 'echo',
        args: ['Hello, World!']
      });
      
      expect(result.stdout).toBe('Hello, World!\n');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.adapter).toBe('local');
      expect(mockSpawn).toHaveBeenCalledWith('echo', ['Hello, World!'], expect.any(Object));
    });
    
    it('should handle shell mode correctly', async () => {
      const mockProcess = createMockProcess({
        stdout: 'file1.txt file2.txt',
        stderr: '',
        exitCode: 0
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      await adapter.execute({
        command: 'ls *.txt | grep file',
        shell: true
      });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'ls *.txt | grep file',
        [],
        expect.objectContaining({ shell: true })
      );
    });
    
    it('should handle command with no output', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: '',
        exitCode: 0
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const result = await adapter.execute({
        command: 'touch',
        args: ['newfile.txt']
      });
      
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });
  });
  
  describe('Error handling', () => {
    it('should handle non-zero exit codes', async () => {
      const mockProcess = createMockProcess({
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const result = await adapter.execute({
        command: 'nonexistent-command'
      });
      
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toBe('Command not found');
    });
    
    it('should handle process spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn ENOENT');
      });
      
      await expect(adapter.execute({
        command: 'bad-command'
      })).rejects.toThrow('spawn ENOENT');
    });
    
    it('should handle signals', async () => {
      const mockProcess = createMockProcess({
        stdout: 'Partial output',
        stderr: '',
        exitCode: undefined,
        signal: 'SIGTERM' as NodeJS.Signals
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const result = await adapter.execute({
        command: 'long-running-command'
      });
      
      expect(result.exitCode).toBe(0); // null becomes 0
      expect(result.signal).toBe('SIGTERM');
    });
  });
  
  describe('Environment and working directory', () => {
    it('should use custom environment variables', async () => {
      const mockProcess = createMockProcess({
        stdout: 'production',
        exitCode: 0
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      await adapter.execute({
        command: 'echo',
        args: ['$NODE_ENV'],
        env: { NODE_ENV: 'production' },
        shell: true
      });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ NODE_ENV: 'production' })
        })
      );
    });
    
    it('should use custom working directory', async () => {
      const mockProcess = createMockProcess({
        stdout: '/custom/path',
        exitCode: 0
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      await adapter.execute({
        command: 'pwd',
        cwd: '/custom/path'
      });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'pwd',
        [],
        expect.objectContaining({ cwd: '/custom/path' })
      );
    });
  });
  
  describe('Stream handling', () => {
    it('should handle stdin from string', async () => {
      const mockProcess = new MockProcess({ stdout: 'INPUT DATA', exitCode: 0 });
      mockSpawn.mockReturnValue(mockProcess as any);
      
      // Track what was written to stdin
      let stdinData = '';
      mockProcess.stdin = new Writable({
        write(chunk, encoding, callback) {
          stdinData += chunk.toString();
          callback();
        }
      });
      
      await adapter.execute({
        command: 'cat',
        stdin: 'INPUT DATA'
      });
      
      expect(stdinData).toBe('INPUT DATA');
    });
    
    it('should handle stdin from Buffer', async () => {
      const mockProcess = new MockProcess({ stdout: 'buffer data', exitCode: 0 });
      mockSpawn.mockReturnValue(mockProcess as any);
      
      let stdinData = Buffer.alloc(0);
      mockProcess.stdin = new Writable({
        write(chunk, encoding, callback) {
          stdinData = Buffer.concat([stdinData, chunk]);
          callback();
        }
      });
      
      const inputBuffer = Buffer.from('buffer data');
      await adapter.execute({
        command: 'cat',
        stdin: inputBuffer
      });
      
      expect(stdinData.equals(inputBuffer)).toBe(true);
    });
    
    it('should handle stdin from Readable stream', async () => {
      const mockProcess = new MockProcess({ stdout: 'streamed data', exitCode: 0 });
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const inputStream = new Readable({
        read() {
          this.push('streamed data');
          this.push(null);
        }
      });
      
      await adapter.execute({
        command: 'cat',
        stdin: inputStream
      });
      
      // The stream should be piped
      expect(mockProcess.stdin).toBeDefined();
    });
    
    it('should respect stdout options', async () => {
      const mockProcess = createMockProcess({
        stdout: 'output',
        exitCode: 0
      });
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      await adapter.execute({
        command: 'echo',
        args: ['test'],
        stdout: 'ignore'
      });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'echo',
        ['test'],
        expect.objectContaining({
          stdio: ['ignore', 'ignore', 'pipe']
        })
      );
    });
  });
  
  describe('Timeout handling', () => {
    it('should kill process on timeout', async () => {
      jest.useFakeTimers();
      
      const mockProcess = new MockProcess({
        stdout: '',
        exitCode: 0,
        delay: 2000 // 2 second delay
      });
      
      // Override exit to not complete
      mockProcess.exit = jest.fn();
      mockProcess.kill = jest.fn(() => true);
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const promise = adapter.execute({
        command: 'sleep',
        args: ['10'],
        timeout: 100
      });
      
      // Advance timers
      jest.advanceTimersByTime(150);
      
      await expect(promise).rejects.toThrow(TimeoutError);
      expect(mockProcess.kill).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
  
  describe('Signal handling', () => {
    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const mockProcess = new MockProcess({
        stdout: '',
        exitCode: 0,
        delay: 1000
      });
      
      mockProcess.kill = jest.fn(() => true);
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const promise = adapter.execute({
        command: 'long-command',
        signal: controller.signal
      });
      
      // Abort immediately
      controller.abort();
      
      await expect(promise).rejects.toThrow('Operation aborted');
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
  
  describe('Configuration options', () => {
    it('should respect uid and gid options', async () => {
      const adapterWithUid = new LocalAdapter({
        uid: 1000,
        gid: 1000
      });
      
      const mockProcess = createMockProcess({ exitCode: 0 });
      mockSpawn.mockReturnValue(mockProcess as any);
      
      await adapterWithUid.execute({ command: 'id' });
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'id',
        [],
        expect.objectContaining({
          uid: 1000,
          gid: 1000
        })
      );
    });
    
    it('should use custom kill signal', async () => {
      const adapterWithSignal = new LocalAdapter({
        killSignal: 'SIGKILL'
      });
      
      jest.useFakeTimers();
      
      const mockProcess = new MockProcess({ delay: 2000 });
      mockProcess.exit = jest.fn();
      mockProcess.kill = jest.fn(() => true);
      
      mockSpawn.mockReturnValue(mockProcess as any);
      
      const promise = adapterWithSignal.execute({
        command: 'sleep',
        args: ['10'],
        timeout: 100
      });
      
      jest.advanceTimersByTime(150);
      
      await expect(promise).rejects.toThrow();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      
      jest.useRealTimers();
    });
  });
  
  describe('Bun runtime support', () => {
    beforeEach(() => {
      (RuntimeDetector.isBun as jest.Mock).mockReturnValue(true);
      (RuntimeDetector.isNode as jest.Mock).mockReturnValue(false);
    });
    
    it('should use Bun.spawn when available and preferred', async () => {
      const adapterWithBun = new LocalAdapter({ preferBun: true });
      
      // Mock Bun global
      const mockRead = jest.fn() as any;
      mockRead
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Bun output') })
        .mockResolvedValueOnce({ done: true });

      const mockStderrRead = jest.fn() as any;
      mockStderrRead.mockResolvedValueOnce({ done: true });

      const mockBunSpawn = jest.fn().mockReturnValue({
        stdout: {
          getReader: () => ({
            read: mockRead,
            releaseLock: jest.fn()
          })
        },
        stderr: {
          getReader: () => ({
            read: mockStderrRead,
            releaseLock: jest.fn()
          })
        },
        stdin: {
          getWriter: () => ({
            write: jest.fn(),
            close: jest.fn()
          })
        },
        exited: Promise.resolve(0),
        kill: jest.fn()
      });
      
      (globalThis as any).Bun = { spawn: mockBunSpawn };
      
      const result = await adapterWithBun.execute({
        command: 'echo',
        args: ['test']
      });
      
      expect(mockBunSpawn).toHaveBeenCalled();
      expect(result.stdout).toBe('Bun output');
      
      delete (globalThis as any).Bun;
    });
  });
});