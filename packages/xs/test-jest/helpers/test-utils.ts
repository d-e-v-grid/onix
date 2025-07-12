import { $ } from '../../src/core';
import { ProcessOutput } from '@onix-js/uxec';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';

/**
 * Create a temporary directory for tests
 */
export async function createTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'xs-test-'));
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Run a command and expect it to succeed
 */
export async function expectSuccess(
  command: string | TemplateStringsArray,
  ...args: any[]
): Promise<ProcessOutput> {
  if (typeof command === 'string') {
    const result = await $`${command}`;
    expect(result.exitCode).toBe(0);
    return result;
  }
  const result = await $(command as TemplateStringsArray, ...args);
  expect(result.exitCode).toBe(0);
  return result;
}

/**
 * Run a command and expect it to fail
 */
export async function expectFailure(
  command: string | TemplateStringsArray,
  ...args: any[]
): Promise<ProcessOutput> {
  if (typeof command === 'string') {
    const result = await $`${command}`.nothrow();
    expect(result.exitCode).not.toBe(0);
    return result;
  }
  const result = await $(command as TemplateStringsArray, ...args).nothrow();
  expect(result.exitCode).not.toBe(0);
  return result;
}

/**
 * Helper to test with different shells
 */
export async function withShell<T>(
  shell: string | boolean,
  fn: () => Promise<T>
): Promise<T> {
  const originalShell = $.shell;
  try {
    $.shell = shell;
    return await fn();
  } finally {
    $.shell = originalShell;
  }
}

/**
 * Helper to test with different working directories
 */
export async function withCwd<T>(
  cwd: string,
  fn: () => Promise<T>
): Promise<T> {
  const originalCwd = $.cwd;
  try {
    $.cwd = cwd;
    return await fn();
  } finally {
    $.cwd = originalCwd;
  }
}

/**
 * Helper to test with different environment variables
 */
export async function withEnv<T>(
  env: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const originalEnv = { ...$.env };
  try {
    Object.assign($.env, env);
    return await fn();
  } finally {
    $.env = originalEnv;
  }
}

/**
 * Skip test on Windows
 */
export function skipOnWindows(fn: () => void) {
  if (process.platform === 'win32') {
    test.skip('Skipped on Windows', fn);
  } else {
    return fn;
  }
}

/**
 * Skip test on non-Windows
 */
export function skipOnNonWindows(fn: () => void) {
  if (process.platform !== 'win32') {
    test.skip('Skipped on non-Windows', fn);
  } else {
    return fn;
  }
}