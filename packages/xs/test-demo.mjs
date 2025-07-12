#!/usr/bin/env node

// Simple test demonstration for xs with uxec backend
import { $, ProcessOutput } from './build/index.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}:`, e.message);
    failed++;
  }
}

console.log('Running xs tests with uxec backend...\n');

// Suppress uncaught exception errors from intentional test failures
process.on('uncaughtException', (err) => {
  // Ignore ProcessOutput errors from our tests
  if (err.name === 'ProcessOutput') {
    return;
  }
  console.error('Unexpected error:', err);
  process.exit(1);
});

// Test 1: Basic command execution
await test('Basic command execution', async () => {
  const result = await $`echo "Hello from uxec!"`;
  
  if (!(result instanceof ProcessOutput)) throw new Error('Result is not ProcessOutput');
  if (result.exitCode !== 0) throw new Error(`Exit code: ${result.exitCode}`);
  if (result.stdout !== 'Hello from uxec!\n') throw new Error(`Stdout: ${result.stdout}`);
  if (result.stderr !== '') throw new Error(`Stderr: ${result.stderr}`);
});

// Test 2: nothrow()
await test('nothrow() method', async () => {
  const result = await $`exit 1`.nothrow();
  
  if (result.exitCode !== 1) throw new Error(`Exit code should be 1, got: ${result.exitCode}`);
  if (!result.stderr.includes('exit code 1')) throw new Error('Stderr should contain error');
});

// Test 3: quiet()
await test('quiet() method', async () => {
  const originalVerbose = $.verbose;
  $.verbose = true;
  
  const result = await $`echo "quiet test"`.quiet();
  
  if (result.stdout !== 'quiet test\n') throw new Error(`Stdout: ${result.stdout}`);
  if (result.exitCode !== 0) throw new Error(`Exit code: ${result.exitCode}`);
  
  $.verbose = originalVerbose;
});

// Test 4: sync execution
await test('Sync execution', () => {
  const result = $.sync`echo "sync test"`;
  
  if (!(result instanceof ProcessOutput)) throw new Error('Result is not ProcessOutput');
  if (result.stdout !== 'sync test\n') throw new Error(`Stdout: ${result.stdout}`);
  if (result.exitCode !== 0) throw new Error(`Exit code: ${result.exitCode}`);
});

// Test 5: Environment variables
await test('Environment variables', async () => {
  $.env.TEST_UXEC_VAR = 'test_value';
  const result = await $`echo $TEST_UXEC_VAR`;
  
  if (result.stdout !== 'test_value\n') throw new Error(`Stdout: ${result.stdout}`);
  
  delete $.env.TEST_UXEC_VAR;
});

// Test 6: Working directory
await test('Working directory', async () => {
  const originalCwd = $.cwd;
  $.cwd = '/tmp';
  
  const result = await $`pwd`;
  if (!result.stdout.trim().includes('tmp')) throw new Error(`PWD: ${result.stdout}`);
  
  $.cwd = originalCwd;
});

// Test 7: ProcessOutput methods
await test('ProcessOutput text() method', async () => {
  const result = await $`echo "  trimmed  "`;
  if (result.text() !== 'trimmed') throw new Error(`text(): ${result.text()}`);
});

await test('ProcessOutput lines() method', async () => {
  const result = await $`printf "line1\nline2\nline3"`;
  const lines = result.lines();
  
  if (!Array.isArray(lines)) throw new Error('lines() should return array');
  if (lines.length !== 3) throw new Error(`Expected 3 lines, got ${lines.length}`);
  if (lines[0] !== 'line1') throw new Error(`First line: ${lines[0]}`);
});

await test('ProcessOutput toString() method', async () => {
  const result = await $`echo "test output"`;
  if (result.toString() !== 'test output') throw new Error(`toString(): ${result.toString()}`);
});

// Test 8: Error handling
await test('Error handling with ProcessOutput', async () => {
  try {
    await $`exit 42`;
    throw new Error('Should have thrown');
  } catch (error) {
    if (!(error instanceof ProcessOutput)) throw new Error('Error is not ProcessOutput');
    if (error.exitCode !== 42) throw new Error(`Exit code: ${error.exitCode}`);
  }
});

// Test 9: Template literal interpolation
await test('String interpolation', async () => {
  const name = 'uxec';
  const result = await $`echo "Hello, ${name}!"`;
  
  if (result.stdout !== 'Hello, uxec!\n') throw new Error(`Stdout: ${result.stdout}`);
});

await test('Array interpolation', async () => {
  const items = ['apple', 'banana', 'cherry'];
  const result = await $`echo ${items}`;
  
  if (result.stdout !== 'apple banana cherry\n') throw new Error(`Stdout: ${result.stdout}`);
});

await test('Special character quoting', async () => {
  const special = 'test$variable"with\'quotes`and\\backslash';
  const result = await $`printf "%s" ${special}`;
  
  if (result.stdout !== special) {
    console.log(`  Expected: ${special}`);
    console.log(`  Got:      ${result.stdout}`);
    throw new Error(`Special character mismatch`);
  }
});

// Test 10: Timeout
await test('Timeout', async () => {
  const result = await $`sleep 0.01`.timeout(1000);
  if (result.exitCode !== 0) throw new Error(`Exit code: ${result.exitCode}`);
});

// Summary
console.log('\n--- Test Summary ---');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n✅ All tests passed! xs with uxec backend is working correctly.');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed.');
  process.exit(1);
}