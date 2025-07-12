import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Helper for getting __filename and __dirname in ESM
export function getFilePaths(importMetaUrl: string) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = dirname(__filename);
  return { __filename, __dirname };
}

// Since import.meta.url is not available in tests, use a workaround
export function getTestPaths(testFile: string) {
  const __dirname = join(process.cwd(), dirname(testFile));
  const __filename = join(process.cwd(), testFile);
  return { __filename, __dirname };
}