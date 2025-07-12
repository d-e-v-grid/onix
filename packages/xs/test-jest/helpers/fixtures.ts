import { join } from 'path';

export const FIXTURES_DIR = join(process.cwd(), 'test-jest', 'fixtures');

export const fixtures = {
  scripts: {
    echo: join(FIXTURES_DIR, 'echo.mjs'),
    exitCode: join(FIXTURES_DIR, 'exit-code.mjs'),
    argv: join(FIXTURES_DIR, 'argv.mjs'),
    interactive: join(FIXTURES_DIR, 'interactive.mjs'),
  },
  files: {
    markdown: join(FIXTURES_DIR, 'markdown.md'),
    markdownCrlf: join(FIXTURES_DIR, 'markdown-crlf.md'),
    copyright: join(FIXTURES_DIR, 'copyright.txt'),
    noExtension: join(FIXTURES_DIR, 'no-extension'),
  },
  projects: {
    js: join(FIXTURES_DIR, 'js-project'),
    ts: join(FIXTURES_DIR, 'ts-project'),
  },
};

/**
 * Test data for various scenarios
 */
export const testData = {
  simpleCommands: [
    'echo "Hello, World!"',
    'echo $USER',
    'pwd',
    'ls -la',
  ],
  
  errorCommands: [
    'exit 1',
    'false',
    'command-that-does-not-exist',
  ],
  
  specialCharacters: [
    'bar"";baz!$#^$\'&*~*%)({}||\\/',
    'hello world',
    'test\nwith\nnewlines',
    'tab\ttab',
  ],
  
  environmentVariables: {
    TEST_VAR: 'test_value',
    SPECIAL_VAR: 'value with spaces',
    EMPTY_VAR: '',
  },
};