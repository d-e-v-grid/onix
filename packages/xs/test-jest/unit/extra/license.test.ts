import { describe, it, expect } from '@jest/globals';
import path from 'node:path';
import { fs, globby } from '../../../src/index';

describe('License compliance', () => {
  it('should have license header in every source file', async () => {
    // Read the copyright template
    const copyrightPath = path.resolve(process.cwd(), 'test-jest/fixtures/copyright.txt');
    const copyright = await fs.readFile(copyrightPath, 'utf8');
    
    // Find all JavaScript and TypeScript files
    const files = await globby(
      ['**/*.{js,mjs,ts}', '!**/*polyfill.js', '!build'],
      {
        gitignore: true,
        onlyFiles: true,
        cwd: process.cwd(),
        followSymbolicLinks: false,
      }
    );
    
    // Check each file
    const filesWithoutLicense: string[] = [];
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      // Replace year with YEAR to make the check year-agnostic
      const normalizedContent = content.replace(/\d{4}/g, 'YEAR');
      
      if (!normalizedContent.includes(copyright)) {
        filesWithoutLicense.push(file);
      }
    }
    
    // Report all files without license at once for better error messages
    if (filesWithoutLicense.length > 0) {
      const errorMessage = `The following files are missing license headers:\n${
        filesWithoutLicense.map(f => `  - ${f}`).join('\n')
      }`;
      expect(filesWithoutLicense).toHaveLength(0);
      throw new Error(errorMessage);
    }
  });

  it('should have correct copyright format', async () => {
    // Verify the copyright file itself exists and is valid
    const copyrightPath = path.resolve(process.cwd(), 'test-jest/fixtures/copyright.txt');
    const copyrightExists = await fs.pathExists(copyrightPath);
    
    expect(copyrightExists).toBe(true);
    
    const copyright = await fs.readFile(copyrightPath, 'utf8');
    
    // Check that copyright contains expected patterns
    expect(copyright).toContain('Copyright');
    expect(copyright).toContain('Google LLC');
    expect(copyright).toContain('Apache License, Version 2.0');
    expect(copyright).toContain('WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND');
  });

  it('should exclude expected files from license check', async () => {
    // Verify that polyfill files and build directory are excluded
    const files = await globby(
      ['**/*.{js,mjs,ts}', '!**/*polyfill.js', '!build'],
      {
        gitignore: true,
        onlyFiles: true,
        cwd: process.cwd(),
        followSymbolicLinks: false,
      }
    );
    
    // Check that no polyfill files or build files are included
    const shouldBeExcluded = files.filter(f => 
      f.includes('polyfill.js') || f.startsWith('build/')
    );
    
    expect(shouldBeExcluded).toHaveLength(0);
  });

  it('should only check JavaScript and TypeScript files', async () => {
    const files = await globby(
      ['**/*.{js,mjs,ts}', '!**/*polyfill.js', '!build'],
      {
        gitignore: true,
        onlyFiles: true,
        cwd: process.cwd(),
        followSymbolicLinks: false,
      }
    );
    
    // Verify all files have expected extensions
    const validExtensions = ['.js', '.mjs', '.ts'];
    const invalidFiles = files.filter(f => {
      const ext = path.extname(f);
      return !validExtensions.includes(ext);
    });
    
    expect(invalidFiles).toHaveLength(0);
  });
});