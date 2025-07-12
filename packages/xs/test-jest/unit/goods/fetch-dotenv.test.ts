import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { $ } from '../../../src/index';
import { fetch } from '../../../src/goods';
import { dotenv } from '../../../src/vendor';
import { tempfile } from '../../../src/index';
import fs from 'node:fs/promises';

describe('Fetch and dotenv utilities', () => {
  describe('fetch()', () => {
    it('should fetch from URL', async () => {
      const response = await fetch('https://example.com/');
      
      expect(response.status).toBe(200);
    });

    it('should support piping to commands', async () => {
      const req = fetch('https://example.com/');
      const output = await req.pipe`cat`;
      
      expect(output.stdout).toContain('Example Domain');
    });

    it('should support piping to $ commands', async () => {
      const req = fetch('https://example.com/');
      const output = await req.pipe($`cat`);
      
      expect(output.stdout).toContain('Example Domain');
    });

    it('should handle different HTTP methods', async () => {
      const req = fetch('https://example.com/', { method: 'OPTIONS' });
      const response = await req;
      
      // OPTIONS might not be supported, expect non-200 status
      expect(response.status).toBe(501);
    });

    it('should support multiple concurrent fetches', async () => {
      const req1 = fetch('https://example.com/');
      const req2 = fetch('https://example.com/');
      
      const [res1, res2] = await Promise.all([req1, req2]);
      
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    it('should handle fetch errors gracefully', async () => {
      try {
        await fetch('https://invalid-domain-that-does-not-exist.com/');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should support request headers', async () => {
      const response = await fetch('https://example.com/', {
        headers: {
          'User-Agent': 'zx-test'
        }
      });
      
      expect(response.status).toBe(200);
    });
  });

  describe('dotenv', () => {
    describe('parse()', () => {
      it('should parse empty string', () => {
        expect(dotenv.parse('')).toEqual({});
      });

      it('should parse basic env format', () => {
        const result = dotenv.parse('ENV=v1\nENV2=v2\n\n\n  ENV3  =    v3   \nexport ENV4=v4');
        
        expect(result).toEqual({
          ENV: 'v1',
          ENV2: 'v2',
          ENV3: 'v3',
          ENV4: 'v4',
        });
      });

      it('should handle comments', () => {
        const result = dotenv.parse(`
          # This is a comment
          VAR1=value1
          VAR2=value2 # inline comment
          # Another comment
          VAR3=value3
        `);
        
        expect(result).toEqual({
          VAR1: 'value1',
          VAR2: 'value2',
          VAR3: 'value3',
        });
      });

      it('should parse multiline values', () => {
        const multiline = `SIMPLE=xyz123
# comment ###
NON_INTERPOLATED='raw text without variable interpolation' 
MULTILINE = """
long text here, # not-comment
e.g. a private SSH key
"""
ENV=v1\nENV2=v2\n\n\n\t\t  ENV3  =    v3   \n   export ENV4=v4
ENV5=v5 # comment
`;
        
        const result = dotenv.parse(multiline);
        
        expect(result).toEqual({
          SIMPLE: 'xyz123',
          NON_INTERPOLATED: 'raw text without variable interpolation',
          MULTILINE: 'long text here, # not-comment\ne.g. a private SSH key',
          ENV: 'v1',
          ENV2: 'v2',
          ENV3: 'v3',
          ENV4: 'v4',
          ENV5: 'v5',
        });
      });

      it('should handle quoted values', () => {
        const result = dotenv.parse(`
          SINGLE='single quoted'
          DOUBLE="double quoted"
          BACKTICK=\`backtick quoted\`
          UNQUOTED=unquoted value
        `);
        
        expect(result).toEqual({
          SINGLE: 'single quoted',
          DOUBLE: 'double quoted',
          BACKTICK: 'backtick quoted',
          UNQUOTED: 'unquoted value',
        });
      });

      it('should handle empty values', () => {
        const result = dotenv.parse(`
          EMPTY=
          EMPTY_QUOTED=""
          SPACES=   
        `);
        
        expect(result).toEqual({
          EMPTY: '',
          EMPTY_QUOTED: '',
          SPACES: '',
        });
      });

      it('should ignore malformed lines', () => {
        const result = dotenv.parse(`
          VALID=value
          THIS IS INVALID
          =NO_KEY
          ANOTHER=valid
        `);
        
        expect(result).toEqual({
          VALID: 'value',
          ANOTHER: 'valid',
        });
      });
    });

    describe('load()', () => {
      let file1: string;
      let file2: string;

      beforeEach(async () => {
        file1 = tempfile('.env.1', 'ENV1=value1\nENV2=value2');
        file2 = tempfile('.env.2', 'ENV2=value222\nENV3=value3');
      });

      afterEach(async () => {
        await Promise.all([
          fs.rm(file1).catch(() => {}),
          fs.rm(file2).catch(() => {})
        ]);
      });

      it('should load env from files', () => {
        const env = dotenv.load(file1, file2);
        
        expect(env.ENV1).toBe('value1');
        expect(env.ENV2).toBe('value2'); // First file takes precedence
        expect(env.ENV3).toBe('value3');
      });

      it('should throw error on ENOENT', () => {
        try {
          dotenv.load('./.env.nonexistent');
          expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
          expect(e.code).toBe('ENOENT');
          expect(e.errno).toBe(-2);
        }
      });

      it('should load from single file', () => {
        const env = dotenv.load(file1);
        
        expect(env.ENV1).toBe('value1');
        expect(env.ENV2).toBe('value2');
        expect(env.ENV3).toBeUndefined();
      });

      it('should handle file with complex content', async () => {
        const complexFile = tempfile('.env.complex', `
          # Database configuration
          DB_HOST=localhost
          DB_PORT=5432
          DB_NAME="my database"
          
          # API keys
          API_KEY='secret-key-123'
          API_SECRET=\${API_KEY}-suffix
          
          # Multiline
          CERT="""
          -----BEGIN CERTIFICATE-----
          MIIDtTCCAp2gAwIBAgIJAKg4VeVcIDz1MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
          -----END CERTIFICATE-----
          """
        `);
        
        const env = dotenv.load(complexFile);
        
        expect(env.DB_HOST).toBe('localhost');
        expect(env.DB_PORT).toBe('5432');
        expect(env.DB_NAME).toBe('my database');
        expect(env.API_KEY).toBe('secret-key-123');
        expect(env.CERT).toContain('BEGIN CERTIFICATE');
        
        await fs.rm(complexFile);
      });
    });

    describe('loadSafe()', () => {
      let file1: string;

      beforeEach(async () => {
        file1 = tempfile('.env.1', 'ENV1=value1\nENV2=value2');
      });

      afterEach(async () => {
        await fs.rm(file1).catch(() => {});
      });

      it('should load env from existing files', () => {
        const env = dotenv.loadSafe(file1, '.env.notexists');
        
        expect(env.ENV1).toBe('value1');
        expect(env.ENV2).toBe('value2');
      });

      it('should not throw on missing files', () => {
        const env = dotenv.loadSafe('.env.missing1', '.env.missing2');
        
        expect(env).toEqual({});
      });

      it('should load from mix of existing and missing files', () => {
        const env = dotenv.loadSafe('.env.missing', file1, '.env.alsoMissing');
        
        expect(env.ENV1).toBe('value1');
        expect(env.ENV2).toBe('value2');
      });
    });

    describe('config()', () => {
      let file1: string;
      let originalEnv: NodeJS.ProcessEnv;

      beforeEach(async () => {
        file1 = tempfile('.env.1', 'TEST_ENV1=testvalue1');
        originalEnv = { ...process.env };
      });

      afterEach(async () => {
        // Clean up environment
        delete process.env.TEST_ENV1;
        await fs.rm(file1).catch(() => {});
      });

      it('should update process.env', () => {
        expect(process.env.TEST_ENV1).toBeUndefined();
        
        dotenv.config(file1);
        
        expect(process.env.TEST_ENV1).toBe('testvalue1');
      });

      it('should not override existing env vars', async () => {
        process.env.TEST_ENV1 = 'original';
        
        const envFile = tempfile('.env.override', 'TEST_ENV1=new_value');
        dotenv.config(envFile);
        
        expect(process.env.TEST_ENV1).toBe('original');
        
        await fs.rm(envFile);
      });

      it('should handle multiple files', async () => {
        const file2 = tempfile('.env.2', 'TEST_ENV2=testvalue2');
        
        dotenv.config(file1, file2);
        
        expect(process.env.TEST_ENV1).toBe('testvalue1');
        expect(process.env.TEST_ENV2).toBe('testvalue2');
        
        delete process.env.TEST_ENV2;
        await fs.rm(file2);
      });
    });
  });
});