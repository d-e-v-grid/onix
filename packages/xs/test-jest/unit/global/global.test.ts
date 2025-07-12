import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import '../../../src/globals';
import * as index from '../../../src/index';

describe('Global injection', () => {
  let originalGlobals: Record<string, any> = {};

  beforeAll(() => {
    // Store original global values to restore later
    for (const key of Object.keys(index)) {
      if (key in global) {
        originalGlobals[key] = (global as any)[key];
      }
    }
  });

  afterAll(() => {
    // Clean up injected globals
    for (const key of Object.keys(index)) {
      delete (global as any)[key];
    }
    
    // Restore original globals
    for (const [key, value] of Object.entries(originalGlobals)) {
      (global as any)[key] = value;
    }
  });

  it('should inject all index exports to global', () => {
    for (const [key, value] of Object.entries(index)) {
      expect((global as any)[key]).toBe(value);
    }
  });

  it('should make $ available globally', () => {
    expect(typeof (global as any).$).toBe('function');
    expect((global as any).$).toBe(index.$);
  });

  it('should make cd available globally', () => {
    expect(typeof (global as any).cd).toBe('function');
    expect((global as any).cd).toBe(index.cd);
  });

  it('should make chalk available globally', () => {
    expect(typeof (global as any).chalk).toBe('function');
    expect((global as any).chalk).toBe(index.chalk);
  });

  it('should make fs available globally', () => {
    expect(typeof (global as any).fs).toBe('object');
    expect((global as any).fs).toBe(index.fs);
  });

  it('should make path available globally', () => {
    expect(typeof (global as any).path).toBe('object');
    expect((global as any).path).toBe(index.path);
  });

  it('should make fetch available globally', () => {
    expect(typeof (global as any).fetch).toBe('function');
    expect((global as any).fetch).toBe(index.fetch);
  });

  it('should make echo available globally', () => {
    expect(typeof (global as any).echo).toBe('function');
    expect((global as any).echo).toBe(index.echo);
  });

  it('should make question available globally', () => {
    expect(typeof (global as any).question).toBe('function');
    expect((global as any).question).toBe(index.question);
  });

  it('should make sleep available globally', () => {
    expect(typeof (global as any).sleep).toBe('function');
    expect((global as any).sleep).toBe(index.sleep);
  });

  it('should make which available globally', () => {
    expect(typeof (global as any).which).toBe('function');
    expect((global as any).which).toBe(index.which);
  });

  it('should make YAML available globally', () => {
    expect(typeof (global as any).YAML).toBe('object');
    expect((global as any).YAML).toBe(index.YAML);
  });

  it('should make minimist available globally', () => {
    expect(typeof (global as any).minimist).toBe('function');
    expect((global as any).minimist).toBe(index.minimist);
  });

  it('should make argv available globally', () => {
    expect(typeof (global as any).argv).toBe('object');
    expect((global as any).argv).toBe(index.argv);
  });

  it('should make ProcessOutput available globally', () => {
    expect(typeof (global as any).ProcessOutput).toBe('function');
    expect((global as any).ProcessOutput).toBe(index.ProcessOutput);
  });

  describe('global cd() functionality', () => {
    it('should change directory', async () => {
      const $ = (global as any).$;
      const cd = (global as any).cd;
      const path = (global as any).path;
      
      // Get current directory
      const cwd = (await $`pwd`).toString().trim();
      
      // Change to root
      cd('/');
      const rootPwd = (await $`pwd`).toString().trim();
      expect(rootPwd).toBe(path.resolve('/'));
      
      // Change back
      cd(cwd);
      const restoredPwd = (await $`pwd`).toString().trim();
      expect(restoredPwd).toBe(cwd);
    });

    it('should work with relative paths', async () => {
      const $ = (global as any).$;
      const cd = (global as any).cd;
      
      const originalCwd = (await $`pwd`).toString().trim();
      
      // Create a temporary directory
      const tmpDir = (await $`mktemp -d`).toString().trim();
      
      try {
        cd(tmpDir);
        await $`mkdir -p subdir`;
        
        // Test relative path
        cd('./subdir');
        const subPwd = (await $`pwd`).toString().trim();
        expect(subPwd).toContain('subdir');
        
        // Test parent directory
        cd('..');
        const parentPwd = (await $`pwd`).toString().trim();
        expect(parentPwd).toBe(tmpDir);
      } finally {
        // Clean up and restore
        cd(originalCwd);
        await $`rm -rf ${tmpDir}`;
      }
    });
  });

  it('should have all utility functions available', () => {
    const utilities = [
      'glob', 'globby', 'within', 'retry', 'spinner', 
      'stdin', 'nothrow', 'quiet', 'quote', 'quotePowerShell'
    ];
    
    for (const util of utilities) {
      expect((global as any)[util]).toBeDefined();
      expect((global as any)[util]).toBe((index as any)[util]);
    }
  });
});