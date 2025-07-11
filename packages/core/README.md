# @onix-js/core

The core orchestration engine for the Onix infrastructure management system. This package contains all the business logic for infrastructure automation, including playbook execution, inventory management, SSH client operations, and task system.

## 🏗️ Architecture

The core package is organized into several key modules:

### Core Components

- **Onix** - Main orchestration class that ties everything together
- **Playbook** - Task execution workflows
- **Inventory** - Host and group management
- **Task System** - Pluggable task execution framework

### Execution Engine

- **Executor** - Task execution engine with parallel processing
- **SSHClient** - Secure remote execution client
- **Command** - Command execution abstraction

### Infrastructure Management

- **Infrastructure** - Infrastructure context and configuration
- **InfrastructureLoader** - Loading infrastructure definitions
- **TemplateEngine** - Variable substitution and templating

### Logging & Monitoring

- **LoggerFactory** - Logger creation and configuration
- **StructuredLogger** - Structured logging implementation
- **Metrics** - Prometheus metrics collection

## 📦 Installation

```bash
npm install @onix-js/core
```

## 🚀 Quick Start

```typescript
import { Onix, Playbook, Task, Inventory } from '@onix-js/core';

// Initialize Onix
const onix = new Onix({
  logLevel: 'info',
  logFormat: 'json',
  dryRun: false
});

// Create inventory
const inventory = onix.inventory;
inventory.addHost({
  hostname: 'server1',
  ip: '192.168.1.10',
  username: 'admin',
  port: 22
});

// Create a playbook
const playbook = new Playbook([
  new ShellTask({
    name: 'update-system',
    command: 'apt update && apt upgrade -y'
  })
]);

// Register playbook
onix.registerPlaybook('system-update', playbook);

// Execute playbook
const runner = new PlaybookRunner(onix.context);
const results = await runner.run(playbook, inventory.listHosts());
```

## 🔧 Core Classes

### Onix

Main orchestration class that provides the entry point for all operations.

```typescript
import { Onix, OnixConfig } from '@onix-js/core';

const config: OnixConfig = {
  logLevel: 'info',
  logFormat: 'json',
  dryRun: false,
  parallelLimit: 5,
  defaultTimeout: 30000
};

const onix = new Onix(config);
```

### Playbook

Represents a collection of tasks to be executed on target hosts.

```typescript
import { Playbook, ShellTask, CopyTask } from '@onix-js/core';

const playbook = new Playbook([
  new ShellTask({
    name: 'install-package',
    command: 'apt install nginx -y'
  }),
  new CopyTask({
    name: 'copy-config',
    source: './nginx.conf',
    destination: '/etc/nginx/nginx.conf'
  })
], {
  name: 'deploy-nginx',
  description: 'Deploy Nginx web server'
});
```

### Inventory

Manages hosts and groups for task execution.

```typescript
import { Inventory, HostConfig } from '@onix-js/core';

const inventory = new Inventory();

// Add hosts
inventory.addHost({
  hostname: 'web1',
  ip: '192.168.1.10',
  username: 'admin',
  port: 22,
  tags: ['web', 'production']
});

// Create groups
const webGroup = inventory.createGroup('webservers', ['web1', 'web2']);

// Find hosts by tags
const productionHosts = inventory.findHostsByTags(['production']);
```

## 🛠️ Task System

### Available Task Types

#### ShellTask

Execute shell commands on remote hosts.

```typescript
import { ShellTask } from '@onix-js/core';

const task = new ShellTask({
  name: 'update-system',
  command: 'apt update && apt upgrade -y',
  timeout: 60000,
  retries: 3
});
```

#### CopyTask

Copy files to remote hosts.

```typescript
import { CopyTask } from '@onix-js/core';

const task = new CopyTask({
  name: 'copy-config',
  source: './config/app.conf',
  destination: '/etc/app/app.conf',
  timeout: 30000
});
```

#### CompositeTask

Combine multiple tasks into a single task.

```typescript
import { CompositeTask, ShellTask, CopyTask } from '@onix-js/core';

const task = new CompositeTask([
  new CopyTask({
    name: 'copy-script',
    source: './scripts/deploy.sh',
    destination: '/tmp/deploy.sh'
  }),
  new ShellTask({
    name: 'execute-script',
    command: 'chmod +x /tmp/deploy.sh && /tmp/deploy.sh'
  })
], {
  name: 'deploy-application'
});
```

### Creating Custom Tasks

```typescript
import { Task, TaskOptions, OnixResult, OnixContext } from '@onix-js/core';

export class CustomTask extends Task {
  constructor(private customLogic: () => Promise<void>, options?: TaskOptions) {
    super(options);
  }

  async execute(context: OnixContext): Promise<OnixResult> {
    try {
      await this.customLogic();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: new OnixError('CUSTOM_TASK_ERROR', error.message) 
      };
    }
  }
}
```

## 🔌 SSH Client

### Basic Usage

```typescript
import { SSHClient, SSHConnectionOptions } from '@onix-js/core';

const options: SSHConnectionOptions = {
  host: '192.168.1.10',
  port: 22,
  username: 'admin',
  password: 'password' // or use privateKey
};

const client = new SSHClient(options);
await client.connect();

const result = await client.executeCommand('ls -la');
console.log(result.stdout);

await client.close();
```

### Connection Pooling

```typescript
import { SSHClientFactory } from '@onix-js/core';

const factory = new SSHClientFactory();
const client = await factory.createClient({
  host: '192.168.1.10',
  username: 'admin',
  privateKey: fs.readFileSync('/path/to/key')
});
```

## 📊 Logging & Metrics

### Logger Configuration

```typescript
import { LoggerFactory, LoggerFormat } from '@onix-js/core';

const logger = LoggerFactory.createLogger({
  format: 'json',
  level: 'info'
});

logger.info('Task started', { taskName: 'deploy-app' });
logger.error('Task failed', { error: 'Connection timeout' });
```

### Metrics Collection

```typescript
import { metricsRegistry, taskCounter, taskDuration } from '@onix-js/core';

// Metrics are automatically collected
const metrics = await metricsRegistry.metrics();
console.log(metrics);
```

## 🔄 Error Handling

### Retry Policy

```typescript
import { RetryPolicy, RetryPolicyOptions } from '@onix-js/core';

const retryPolicy = new RetryPolicy({
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000
});

const result = await retryPolicy.execute(async () => {
  return await riskyOperation();
});
```

### Error Types

```typescript
import { OnixError } from '@onix-js/core';

throw new OnixError(
  'SSH_CONNECTION_FAILED',
  'Failed to connect to host',
  { host: '192.168.1.10', port: 22 }
);
```

## 📝 Template Engine

### Variable Substitution

```typescript
import { TemplateEngine, Variables } from '@onix-js/core';

const variables = new Variables({
  appName: 'myapp',
  version: '1.0.0',
  environment: 'production'
});

const engine = new TemplateEngine(variables);
const result = engine.render('Hello {{appName}} v{{version}}!');
// Result: "Hello myapp v1.0.0!"
```

## 🎯 Events

### Event System

```typescript
import { OnixEvents, OnixEvent } from '@onix-js/core';

OnixEvents.on(OnixEvent.TASK_STARTED, (payload) => {
  console.log('Task started:', payload.taskName);
});

OnixEvents.on(OnixEvent.TASK_COMPLETED, (payload) => {
  console.log('Task completed:', payload.taskName, payload.duration);
});
```

## 📚 API Reference

### Main Exports

```typescript
import {
  // Core classes
  Onix,
  Playbook,
  Inventory,
  Variables,
  
  // Task system
  Task,
  ShellTask,
  CopyTask,
  CompositeTask,
  SSHTaskExecutor,
  
  // SSH client
  SSHClient,
  SSHClientFactory,
  MockSSHClient,
  
  // Logging & metrics
  LoggerFactory,
  StructuredLogger,
  metricsRegistry,
  
  // Error handling
  OnixError,
  RetryPolicy,
  
  // Events
  OnixEvents,
  OnixEvent,
  
  // Types
  OnixConfig,
  OnixContext,
  Logger,
  TaskOptions
} from '@onix-js/core';
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.