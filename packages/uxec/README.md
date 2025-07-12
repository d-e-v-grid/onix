# @onix-js/uxec

Unified Execution Engine - A powerful and flexible execution engine for various environments (local, remote SSH, Docker containers).

## Features

- **Unified API** - Single API for all execution environments
- **Template Literals** - Native support for template literals like zx
- **Multiple Adapters** - Support for local, SSH, Docker
- **Mock Adapter** - Built-in support for testing
- **Bun Support** - Native support for Bun.spawn execution
- **SSH Connection Pooling** - Efficient SSH connection management
- **Stream Handling** - Real-time output streaming
- **TypeScript Support** - Full TypeScript support and type safety

## Installation

```bash
npm install @onix-js/uxec
```

## Quick Start

```typescript
import { $ } from '@onix-js/uxec';

// Basic command execution
const result = await $`echo "Hello, World!"`;
console.log(result.stdout); // "Hello, World!"

// Template literals with variables
const filename = "my file.txt";
await $`touch ${filename}`;

// Environment configuration
const $prod = $.env({ NODE_ENV: 'production' }).cd('/app');
await $prod.run`npm start`;

// SSH execution
const $remote = $.ssh({
  host: 'server.example.com',
  username: 'deploy'
});
await $remote.run`docker restart myapp`;

// Docker execution
const $docker = $.docker({
  container: 'webapp',
  workdir: '/app'
});
await $docker.run`npm run migrate`;
```

## API

### Engine Configuration

```typescript
import { createExecutionEngine } from '@onix-js/uxec';

const $ = createExecutionEngine({
  defaultTimeout: 60000,
  defaultCwd: '/app',
  defaultEnv: { NODE_ENV: 'production' },
  throwOnNonZeroExit: true,
  adapters: {
    ssh: {
      connectionPool: { enabled: true }
    }
  }
});
```

### Chain Configuration

- `$.with(config)` - Create new instance with additional configuration
- `$.cd(dir)` - Change working directory
- `$.env(vars)` - Set environment variables
- `$.timeout(ms)` - Set timeout
- `$.shell(shell)` - Specify shell for execution

### Adapters

- `$.local()` - Local execution (default)
- `$.ssh(options)` - Remote SSH execution
- `$.docker(options)` - Docker container execution

### Error Handling

```typescript
try {
  await $`exit 1`;
} catch (error) {
  if (error instanceof CommandError) {
    console.log('Exit code:', error.exitCode);
    console.log('Stderr:', error.stderr);
  }
}

// Or disable throwing on non-zero exit
const $noThrow = $.with({ throwOnNonZeroExit: false });
const result = await $noThrow.run`exit 1`;
console.log(result.exitCode); // 1
```

## Testing

Use MockAdapter for testing:

```typescript
import { createExecutionEngine, MockAdapter } from '@onix-js/uxec';

const $ = createExecutionEngine();
const mock = new MockAdapter();
$.registerAdapter('mock', mock);

// Mock responses
mock.mockSuccess('git pull', 'Already up to date.');
mock.mockFailure('npm test', 'Tests failed!', 1);

// Execute with mock
const $mock = $.with({ adapter: 'mock' });
const result = await $mock.run`git pull`;

// Assertions
mock.assertCommandExecuted('git pull');
console.log(mock.getExecutedCommands());
```

## License

MIT