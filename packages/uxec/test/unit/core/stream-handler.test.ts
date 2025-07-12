import { Readable } from 'node:stream';
import { it, jest, expect, describe } from '@jest/globals';

import { 
  StreamHandler, 
  streamToString, 
  combineStreams, 
  createLineTransform 
} from '../../../src/core/stream-handler.js';

describe('StreamHandler', () => {
  describe('Basic functionality', () => {
    it('should create with default options', () => {
      const handler = new StreamHandler();
      
      expect(handler.getContent()).toBe('');
      expect(handler.getBuffer().length).toBe(0);
    });
    
    it('should create with custom options', () => {
      const onData = jest.fn();
      const onError = jest.fn();
      
      const handler = new StreamHandler({
        encoding: 'latin1',
        maxBuffer: 1024,
        onData,
        onError
      });
      
      // Test that options are stored (we'll test functionality below)
      expect(handler).toBeDefined();
    });
  });
  
  describe('Transform stream creation', () => {
    it('should collect data through transform stream', async () => {
      const handler = new StreamHandler();
      const transform = handler.createTransform();
      
      const input = 'Hello, World!';
      const output: Buffer[] = [];
      
      transform.on('data', (chunk) => output.push(chunk));
      
      await new Promise<void>((resolve, reject) => {
        transform.on('end', resolve);
        transform.on('error', reject);
        transform.write(Buffer.from(input));
        transform.end();
      });
      
      expect(handler.getContent()).toBe(input);
      expect(Buffer.concat(output).toString()).toBe(input);
    });
    
    it('should handle multiple chunks', async () => {
      const handler = new StreamHandler();
      const transform = handler.createTransform();
      
      const chunks = ['Hello', ', ', 'World', '!'];
      
      await new Promise<void>((resolve, reject) => {
        transform.on('end', resolve);
        transform.on('error', reject);
        
        chunks.forEach(chunk => transform.write(Buffer.from(chunk)));
        transform.end();
      });
      
      expect(handler.getContent()).toBe('Hello, World!');
    });
    
    it('should call onData callback', async () => {
      const onData = jest.fn();
      const handler = new StreamHandler({ onData });
      const transform = handler.createTransform();
      
      await new Promise<void>((resolve, reject) => {
        transform.on('end', resolve);
        transform.on('error', reject);
        
        transform.write(Buffer.from('Test data'));
        transform.end();
      });
      
      expect(onData).toHaveBeenCalledWith('Test data');
    });
    
    it('should respect maxBuffer limit', async () => {
      const handler = new StreamHandler({ maxBuffer: 10 });
      const transform = handler.createTransform();
      
      await expect(new Promise<void>((resolve, reject) => {
        transform.on('end', resolve);
        transform.on('error', reject);
        
        // Try to write more than maxBuffer
        transform.write(Buffer.from('This is a very long string'));
      })).rejects.toThrow('Stream exceeded maximum buffer size of 10 bytes');
    });
    
    it('should handle different encodings', async () => {
      const handler = new StreamHandler({ encoding: 'base64' });
      const transform = handler.createTransform();
      
      const input = Buffer.from('Hello').toString('base64');
      
      await new Promise<void>((resolve, reject) => {
        transform.on('end', resolve);
        transform.on('error', reject);
        
        transform.write(Buffer.from(input, 'base64'));
        transform.end();
      });
      
      expect(handler.getContent()).toBe('Hello');
    });
  });
  
  describe('Content retrieval', () => {
    it('should get content as string', async () => {
      const handler = new StreamHandler();
      const transform = handler.createTransform();
      
      await new Promise<void>((resolve) => {
        transform.on('end', resolve);
        transform.write(Buffer.from('Test content'));
        transform.end();
      });
      
      expect(handler.getContent()).toBe('Test content');
    });
    
    it('should get content as buffer', async () => {
      const handler = new StreamHandler();
      const transform = handler.createTransform();
      
      const input = Buffer.from('Binary data');
      
      await new Promise<void>((resolve) => {
        transform.on('end', resolve);
        transform.write(input);
        transform.end();
      });
      
      const buffer = handler.getBuffer();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.equals(input)).toBe(true);
    });
  });
  
  describe('Reset functionality', () => {
    it('should clear buffer on reset', async () => {
      const handler = new StreamHandler();
      const transform = handler.createTransform();
      
      await new Promise<void>((resolve) => {
        transform.on('end', resolve);
        transform.write(Buffer.from('Some data'));
        transform.end();
      });
      
      expect(handler.getContent()).toBe('Some data');
      
      handler.reset();
      
      expect(handler.getContent()).toBe('');
      expect(handler.getBuffer().length).toBe(0);
    });
  });
});

describe('createLineTransform', () => {
  it('should split input into lines', async () => {
    const lines: string[] = [];
    const transform = createLineTransform((line) => lines.push(line));
    
    await new Promise<void>((resolve) => {
      transform.on('end', resolve);
      transform.write('Line 1\nLine 2\nLine 3\n');
      transform.end();
    });
    
    expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
  });
  
  it('should handle incomplete lines', async () => {
    const lines: string[] = [];
    const transform = createLineTransform((line) => lines.push(line));
    
    await new Promise<void>((resolve) => {
      transform.on('end', resolve);
      transform.write('Line 1\nLine ');
      transform.write('2\nLine 3');
      transform.end();
    });
    
    expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
  });
  
  it('should handle empty lines', async () => {
    const lines: string[] = [];
    const transform = createLineTransform((line) => lines.push(line));
    
    await new Promise<void>((resolve) => {
      transform.on('end', resolve);
      transform.write('Line 1\n\nLine 3\n');
      transform.end();
    });
    
    expect(lines).toEqual(['Line 1', '', 'Line 3']);
  });
  
  it('should pass through original data', async () => {
    const lines: string[] = [];
    const output: Buffer[] = [];
    const transform = createLineTransform((line) => lines.push(line));
    
    transform.on('data', (chunk) => output.push(chunk));
    
    const input = 'Test\nData';
    
    await new Promise<void>((resolve) => {
      transform.on('end', resolve);
      transform.write(input);
      transform.end();
    });
    
    expect(Buffer.concat(output).toString()).toBe(input);
  });
});

describe('streamToString', () => {
  it('should convert readable stream to string', async () => {
    const readable = Readable.from(['Hello', ' ', 'World']);
    const result = await streamToString(readable);
    
    expect(result).toBe('Hello World');
  });
  
  it('should handle buffer chunks', async () => {
    const readable = Readable.from([
      Buffer.from('Hello'),
      Buffer.from(' '),
      Buffer.from('World')
    ]);
    
    const result = await streamToString(readable);
    expect(result).toBe('Hello World');
  });
  
  it('should handle different encodings', async () => {
    const data = 'Hello, 世界';
    const readable = Readable.from([Buffer.from(data, 'utf8')]);
    
    const result = await streamToString(readable, 'utf8');
    expect(result).toBe(data);
  });
  
  it('should handle empty stream', async () => {
    const readable = Readable.from([]);
    const result = await streamToString(readable);
    
    expect(result).toBe('');
  });
});

describe('combineStreams', () => {
  it('should combine stdout and stderr with prefixes', async () => {
    const stdout = new Readable({
      read() {
        this.push('Output line 1\n');
        this.push('Output line 2\n');
        this.push(null);
      }
    });
    
    const stderr = new Readable({
      read() {
        this.push('Error line 1\n');
        this.push('Error line 2\n');
        this.push(null);
      }
    });
    
    const combined = combineStreams(stdout, stderr);
    const chunks: string[] = [];
    
    await new Promise<void>((resolve, reject) => {
      combined.on('data', (chunk) => chunks.push(chunk.toString()));
      combined.on('end', resolve);
      combined.on('error', reject);
    });
    
    const output = chunks.join('');
    expect(output).toContain('[stdout] Output line 1\n');
    expect(output).toContain('[stdout] Output line 2\n');
    expect(output).toContain('[stderr] Error line 1\n');
    expect(output).toContain('[stderr] Error line 2\n');
  });
  
  it('should handle stream errors', async () => {
    const stdout = new Readable({
      read() {
        this.destroy(new Error('Read error'));
      }
    });
    
    const stderr = new Readable({
      read() {
        this.push(null);
      }
    });
    
    const combined = combineStreams(stdout, stderr);
    
    await expect(new Promise((resolve, reject) => {
      combined.on('end', resolve);
      combined.on('error', reject);
    })).rejects.toThrow('Read error');
  });
  
  it('should end when both streams end', async () => {
    const stdout = new Readable({
      read() {
        this.push('stdout data');
        this.push(null);
      }
    });
    
    const stderr = new Readable({
      read() {
        this.push('stderr data');
        this.push(null);
      }
    });
    
    const combined = combineStreams(stdout, stderr);
    let ended = false;
    
    combined.on('end', () => { ended = true; });
    
    // Wait a bit to ensure streams process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(ended).toBe(true);
  });
});