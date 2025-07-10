# @onix-js/cli

Command-line interface for the Onix infrastructure orchestration system. This application provides a comprehensive CLI for managing infrastructure automation, executing playbooks, and monitoring system operations.

## 🚀 Features

- **Playbook Execution** - Deploy and execute playbooks on target hosts
- **Inventory Management** - List and manage hosts and groups
- **Configuration Management** - Load and manage system configuration
- **Metrics Export** - Export Prometheus metrics for monitoring
- **Dry-run Mode** - Test playbooks without actual execution
- **Structured Logging** - JSON and simple log formats
- **SSH-based Execution** - Secure remote task execution

## 📦 Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/d-e-v-grid/onix.git
cd onix

# Install dependencies
yarn install

# Build the CLI
cd apps/onix
yarn build

# Make executable
chmod +x bin/onix
```

### Global Installation

```bash
# Install globally
npm install -g @onix-js/cli

# Or with yarn
yarn global add @onix-js/cli
```

## 🛠️ Usage

### Basic Commands

```bash
# Show help
onix --help

# Show version
onix --version

# Show command help
onix deploy --help
```

### Configuration

The CLI supports configuration through command-line options and configuration files:

```bash
# Use configuration file
onix --config ./config/onix.yaml deploy my-playbook

# Set log level
onix --log-level debug deploy my-playbook

# Set log format
onix --log-format json deploy my-playbook

# Enable dry-run mode
onix --dry-run deploy my-playbook
```

### Environment Variables

```bash
# Set configuration via environment
export ONIX_LOG_LEVEL=debug
export ONIX_LOG_FORMAT=json
export ONIX_DRY_RUN=true

onix deploy my-playbook
```

## 📋 Commands

### Deploy Command

Execute playbooks on target hosts.

```bash
# Deploy playbook to specific hosts
onix deploy my-playbook host1 host2 host3

# Deploy to all hosts in inventory
onix deploy my-playbook

# Dry-run deployment
onix deploy --dry-run my-playbook host1

# Deploy with custom options
onix deploy --timeout 300 my-playbook host1
```

**Options:**
- `--dry-run` - Simulate deployment without executing tasks
- `--timeout <ms>` - Set execution timeout
- `--parallel <number>` - Set parallel execution limit

### Inventory Commands

Manage hosts and groups in the inventory.

```bash
# List all hosts
onix inventory list-hosts

# List all groups
onix inventory list-groups

# Show host details
onix inventory show-host host1

# Show group details
onix inventory show-group webservers
```

### Playbook Commands

Manage and list available playbooks.

```bash
# List all playbooks
onix playbook list

# Show playbook details
onix playbook show my-playbook

# Validate playbook
onix playbook validate my-playbook
```

### Metrics Command

Export Prometheus metrics for monitoring.

```bash
# Export metrics to stdout
onix metrics

# Export metrics to file
onix metrics > metrics.prom

# Export with custom format
onix metrics --format json
```

## 📁 Configuration

### Configuration File Format

The CLI supports YAML and JSON configuration files:

```yaml
# config/onix.yaml
name: "Production Environment"
description: "Production infrastructure configuration"

# Logging settings
logLevel: "info"
logFormat: "json"
logPath: "/var/log/onix.log"

# Execution settings
dryRun: false
parallelLimit: 5
defaultTimeout: 30000

# Inventory settings
inventory:
  hosts: "./inventory/hosts.yaml"
  groups: "./inventory/groups.yaml"

# Variables
variables:
  - "./vars/common.yaml"
  - "./vars/environment.yaml"

# Playbooks path
playbooksPath: "./playbooks"

# Alerting
alertingEnabled: true
```

### Environment Configuration

```bash
# ONIX_NAME - System name
export ONIX_NAME="Production Environment"

# ONIX_LOG_LEVEL - Log level (trace, debug, info, warn, error)
export ONIX_LOG_LEVEL="info"

# ONIX_LOG_FORMAT - Log format (json, simple)
export ONIX_LOG_FORMAT="json"

# ONIX_DRY_RUN - Enable dry-run mode
export ONIX_DRY_RUN="true"

# ONIX_PARALLEL_LIMIT - Parallel execution limit
export ONIX_PARALLEL_LIMIT="5"

# ONIX_DEFAULT_TIMEOUT - Default timeout in milliseconds
export ONIX_DEFAULT_TIMEOUT="30000"
```

## 🔧 Development

### Building from Source

```bash
# Install dependencies
yarn install

# Build the application
yarn build

# Run tests
yarn test

# Lint code
yarn lint
```

### Development Mode

```bash
# Run in development mode
yarn dev

# Watch for changes
yarn watch
```

### Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run specific test file
yarn test commands/deploy.test.ts
```

## 📊 Logging

### Log Levels

- `trace` - Detailed trace information
- `debug` - Debug information
- `info` - General information (default)
- `warn` - Warning messages
- `error` - Error messages

### Log Formats

#### Simple Format

```
[2024-01-15 10:30:45] INFO: Task started taskName=deploy-app
[2024-01-15 10:30:46] INFO: Task completed taskName=deploy-app duration=1000ms
```

#### JSON Format

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "Task started",
  "meta": {
    "taskName": "deploy-app",
    "host": "web1"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

#### SSH Connection Failures

```bash
# Check SSH connectivity
ssh -i /path/to/key admin@hostname

# Verify SSH configuration
onix --log-level debug deploy my-playbook host1
```

#### Permission Issues

```bash
# Make CLI executable
chmod +x bin/onix

# Check file permissions
ls -la bin/onix
```

#### Configuration Issues

```bash
# Validate configuration
onix --config ./config/onix.yaml --dry-run deploy test-playbook

# Check environment variables
env | grep ONIX
```

### Debug Mode

```bash
# Enable debug logging
onix --log-level debug deploy my-playbook

# Enable verbose output
onix --log-level trace deploy my-playbook
```

## 📚 Examples

### Basic Deployment

```bash
# Deploy a web application
onix deploy web-app web1 web2

# Deploy with custom timeout
onix deploy --timeout 600000 database-setup db1 db2

# Dry-run deployment
onix deploy --dry-run maintenance-script all-hosts
```

### Inventory Management

```bash
# List all production hosts
onix inventory list-hosts | grep production

# Show web server group
onix inventory show-group webservers

# Export inventory to JSON
onix inventory list-hosts --format json > inventory.json
```

### Monitoring Integration

```bash
# Export metrics for Prometheus
onix metrics > /var/lib/prometheus/onix.prom

# Send metrics to monitoring system
onix metrics | curl -X POST -d @- http://monitoring:9091/metrics/job/onix
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`yarn install`)
4. Make your changes
5. Run tests (`yarn test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🔗 Links

- [Core Package Documentation](../core/README.md)
- [GitHub Repository](https://github.com/d-e-v-grid/onix)
- [Issue Tracker](https://github.com/d-e-v-grid/onix/issues)