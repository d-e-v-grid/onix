#!/usr/bin/env node

// Demo script showcasing xs with uxec integration
// This demonstrates the enhanced capabilities when using uxec as the execution backend

import { createUxecShell } from '../src/uxec-adapter.js'

// Create a shell with default options
const $ = createUxecShell({
  verbose: true,
  cwd: process.cwd(),
  env: process.env
})

console.log('=== xs + uxec Demo ===\n')

// 1. Basic command execution
console.log('1. Basic command execution:')
const result = await $`echo "Hello from xs with uxec!"`
console.log('Output:', await result.text())

// 2. Piping commands
console.log('\n2. Piping commands:')
const piped = await $`echo "Line 1\nLine 2\nLine 3"`.pipe($`grep "2"`)
console.log('Piped output:', await piped.text())

// 3. JSON parsing
console.log('\n3. JSON parsing:')
const jsonResult = await $`echo '{"name": "xs", "backend": "uxec"}'`
const data = await jsonResult.json()
console.log('Parsed JSON:', data)

// 4. Line-by-line processing
console.log('\n4. Line processing:')
const lines = await $`echo "apple\nbanana\ncherry"`.lines()
console.log('Lines:', lines)

// 5. Synchronous execution
console.log('\n5. Synchronous execution:')
const syncResult = $.sync`echo "Sync execution works!"`
console.log('Sync output:', syncResult.text)

// 6. SSH execution (if configured)
console.log('\n6. SSH execution example:')
console.log('To use SSH, configure like this:')
console.log(`
const $ssh = $.ssh({
  host: 'example.com',
  username: 'user',
  privateKey: fs.readFileSync('~/.ssh/id_rsa')
})

const remoteResult = await $ssh\`uname -a\`
console.log('Remote system:', await remoteResult.text())
`)

// 7. Docker execution (if Docker is available)
console.log('\n7. Docker execution example:')
console.log('To use Docker, configure like this:')
console.log(`
const $docker = $.docker({
  container: 'my-container',
  image: 'alpine:latest'
})

const dockerResult = await $docker\`echo "Hello from Docker!"\`
console.log('Docker output:', await dockerResult.text())
`)

// 8. Error handling
console.log('\n8. Error handling:')
try {
  await $`exit 1`
} catch (error) {
  console.log('Caught error:', error.message)
}

// With nothrow
const failedResult = await $`exit 1`.nothrow()
console.log('Exit code with nothrow:', failedResult.exitCode)

// 9. Timeout handling
console.log('\n9. Timeout example:')
try {
  await $`sleep 10`.timeout(1000) // 1 second timeout
} catch (error) {
  console.log('Command timed out as expected')
}

console.log('\n=== Demo completed! ===')
console.log('\nxs with uxec provides:')
console.log('- Full zx compatibility')
console.log('- SSH execution support')
console.log('- Docker execution support')
console.log('- Enhanced error handling')
console.log('- Synchronous execution')
console.log('- And much more!')