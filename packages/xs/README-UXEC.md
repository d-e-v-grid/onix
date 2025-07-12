# xs with uxec Integration

This document describes the integration of `uxec` (Unified Execution Engine) as the backend for `xs`, providing enhanced capabilities while maintaining full compatibility with Google's `zx`.

## Overview

`xs` is a enhanced version of `zx` that uses `uxec` as its execution backend. This integration provides:

- **Full zx API compatibility** - All existing zx scripts work without modification
- **SSH execution** - Run commands on remote servers seamlessly
- **Docker execution** - Execute commands in containers
- **Enhanced error handling** - Better error messages and debugging
- **Synchronous execution** - Use `$.sync` for synchronous operations
- **Multiple runtime support** - Optimized for both Node.js and Bun

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│     xs      │────▶│ uxec-adapter │────▶│      uxec       │
│  (zx API)   │     │  (bridge)    │     │ (exec engine)   │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                   │
                                    ┌──────────────┴──────────────┐
                                    │                             │
                              ┌─────▼─────┐  ┌─────────┐  ┌──────▼──────┐
                              │   Local   │  │   SSH   │  │   Docker    │
                              │  Adapter  │  │ Adapter │  │   Adapter   │
                              └───────────┘  └─────────┘  └─────────────┘
```

## Usage

### Basic Usage (100% zx Compatible)

```javascript
#!/usr/bin/env xs

// All zx features work as expected
await $`echo "Hello from xs!"`

const branch = await $`git branch --show-current`
await $`echo "Current branch: ${branch}"`

// Piping
await $`cat data.json`
  .pipe($`jq '.users[]'`)
  .pipe($`grep active`)

// Error handling
const result = await $`exit 1`.nothrow()
console.log(result.exitCode) // 1

// JSON parsing
const pkg = await $`cat package.json`.json()
console.log(pkg.name)
```

### SSH Execution

```javascript
const $ssh = $.ssh({
  host: 'server.example.com',
  username: 'deploy',
  privateKey: fs.readFileSync('~/.ssh/id_rsa')
})

// Run commands on remote server
await $ssh`npm install`
await $ssh`npm run build`
await $ssh`pm2 restart app`

// File operations
await $ssh.upload('./dist', '/var/www/app')
await $ssh.download('/var/log/app.log', './logs/')
```

### Docker Execution

```javascript
const $docker = $.docker({
  container: 'my-app',
  image: 'node:18-alpine',
  workdir: '/app'
})

// Run commands in container
await $docker`npm test`
await $docker`npm run lint`

// With specific user
const $root = $.docker({
  container: 'my-app',
  user: 'root'
})
await $root`apk add git`
```

### Parallel Execution

```javascript
const servers = ['web1', 'web2', 'web3']

// Run commands on multiple servers in parallel
const results = await Promise.all(
  servers.map(server => 
    $.ssh({ host: server })`docker pull myapp:latest`
  )
)
```

### Synchronous Execution

```javascript
// Use $.sync for synchronous operations
const result = $.sync`echo "Synchronous execution"`
console.log(result.text) // "Synchronous execution"

// Useful for simple scripts
const files = $.sync`ls -la`.lines
files.forEach(file => console.log(file))
```

## Enhanced Features

### 1. Better Error Messages

```javascript
try {
  await $`command-that-fails`
} catch (error) {
  console.log(error.stdout)  // Full stdout
  console.log(error.stderr)  // Full stderr
  console.log(error.exitCode) // Exit code
  console.log(error.signal)   // Signal if killed
  console.log(error.command)  // Command that failed
  console.log(error.duration) // Execution time
}
```

### 2. Stream Processing

```javascript
// Process large outputs efficiently
await $`find . -name "*.log"`
  .pipe(createGzip())
  .pipe(fs.createWriteStream('logs.tar.gz'))
```

### 3. Advanced Piping

```javascript
// Pipe to template strings
await $`echo "data"`.pipe($`cat > ${filename}`)

// Pipe to writable streams
await $`curl https://example.com/data.json`
  .pipe(createWriteStream('data.json'))
```

### 4. Timeout with Custom Signals

```javascript
// Timeout with custom signal
await $`long-running-process`
  .timeout(5000, 'SIGKILL')
```

## Configuration

### Global Configuration

```javascript
// Configure defaults
$.verbose = true
$.shell = '/bin/bash'
$.prefix = 'set -euo pipefail;'
$.timeout = 30000

// Environment variables
$.env.NODE_ENV = 'production'
```

### Per-Command Configuration

```javascript
await $`npm install`.quiet()
await $`build.sh`.timeout(60000)
await $`test.sh`.env({ CI: 'true' })
```

## Migration from zx

No migration needed! `xs` is 100% compatible with `zx`. Simply:

1. Install xs: `npm install -g @onix-js/xs`
2. Replace `zx` with `xs` in your shebang: `#!/usr/bin/env xs`
3. Enjoy enhanced features!

All your existing zx scripts will work without any changes.

## Performance

`xs` with `uxec` is optimized for performance:

- Minimal overhead for command execution
- Efficient stream processing
- Optimized for Bun runtime when available
- Smart connection pooling for SSH

## Debugging

Enable verbose mode to see all executed commands:

```javascript
$.verbose = true
// or
XS_VERBOSE=1 xs script.mjs
```

## Examples

See the `examples/` directory for more examples:

- `basic-usage.mjs` - Basic zx-compatible usage
- `ssh-deployment.mjs` - Deploy application via SSH
- `docker-ci.mjs` - Run CI pipeline in Docker
- `parallel-tasks.mjs` - Parallel execution patterns
- `uxec-demo.mjs` - Showcase of uxec features

## License

Apache-2.0 (same as zx)