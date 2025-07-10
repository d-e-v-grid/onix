# Onix - Infrastructure Orchestration System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Turborepo](https://img.shields.io/badge/maintained%20with-turborepo-cc00ff.svg)](https://turbo.build/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)

Onix is a modern infrastructure orchestration and configuration management system built with TypeScript. It provides SSH-based task execution, playbook system (similar to Ansible), inventory management, and a pluggable task system for automating infrastructure operations.

## 🏗️ Architecture

Onix follows a modular architecture with clear separation of concerns:

- **Core Package** (`@onix-js/core`) - Core orchestration engine with all business logic
- **CLI Application** (`@onix-js/cli`) - Command-line interface for interacting with the system

## 📦 Packages

### Core Engine (`@onix-js/core`)

The core package contains all the business logic for infrastructure orchestration:

- **Playbooks** - Task execution workflows similar to Ansible playbooks
- **Inventory Management** - Host and group management with SSH configuration
- **Task System** - Pluggable task execution (Shell, Copy, SSH, Composite)
- **SSH Client** - Secure remote execution with connection pooling
- **Logging & Metrics** - Structured logging with Prometheus metrics
- **Template Engine** - Variable substitution and templating
- **Error Handling** - Comprehensive error management with retry policies
- **Event System** - Event-driven architecture for extensibility

### CLI Application (`@onix-js/cli`)

Command-line interface providing:

- **Deploy Commands** - Execute playbooks on target hosts
- **Inventory Management** - List and manage hosts and groups
- **Playbook Operations** - List and manage available playbooks
- **Metrics Export** - Prometheus metrics for monitoring

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22
- Yarn 4.7.0

### Installation

```bash
# Clone the repository
git clone https://github.com/d-e-v-grid/onix.git
cd onix

# Install dependencies
yarn install

# Build all packages
yarn build
```

### Development

```bash
# Run development mode
yarn dev

# Run tests
yarn test

# Lint code
yarn lint

# Fix linting and formatting issues
yarn fix:all
```

### Using the CLI

```bash
# Build the CLI
cd apps/onix
yarn build

# Run the CLI
./bin/onix --help

# Deploy a playbook
./bin/onix deploy my-playbook host1 host2

# List inventory
./bin/onix inventory list-hosts

# List playbooks
./bin/onix playbook list
```

## 🛠️ Tech Stack

- **Language**: TypeScript 5.8.3
- **Runtime**: Node.js 22+
- **Package Manager**: Yarn 4.7.0 (with workspaces)
- **Build System**: Turborepo
- **Testing**: Jest 30
- **Linting**: ESLint 9 with TypeScript support
- **Formatting**: Prettier
- **SSH**: ssh2 library for secure remote execution
- **Metrics**: Prometheus client for monitoring
- **Templating**: Mustache for variable substitution

## 📚 Documentation

Each package contains its own README with detailed documentation:

- [Core Package Documentation](packages/core/README.md)
- [CLI Application Documentation](apps/onix/README.md)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/d-e-v-grid/onix)
- [Issue Tracker](https://github.com/d-e-v-grid/onix/issues)