# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2025-01-12

### Added
- **Packages**: Created `@onix-js/uxec` - Unified Execution Engine package
  - Core execution engine with modular adapter architecture
  - Local execution adapter with Node.js and Bun runtime support
  - SSH adapter with connection pooling and multiplexing support
  - Docker adapter for container command execution
  - Mock adapter for testing
  - Command model with support for streams, timeouts, and signals
  - Comprehensive error handling system with specialized error classes
  - Runtime detection utility for automatic Bun/Node.js selection
  - Shell command escaping and interpolation utilities
  - Stream handling with backpressure support
  - Process promise API inspired by Google zx
  - Template literal support for command execution
  - Chainable API with `.with()`, `.ssh()`, `.docker()`, `.local()` methods
  - TypeScript support with full type definitions
  - Jest test infrastructure with unit and integration tests
  - Comprehensive technical specification documentation
  - Test specification documentation
  - Example usage scripts

### Infrastructure
- **Monorepo**: Continued development of Onix monorepo structure
- **Testing**: Added test fixtures from SSH experiments
- **Documentation**: Added technical specifications for unified execution engine

### Changed
- **Dependencies**: Updated yarn.lock with new dependencies for uxec package

### Security
- **Command Execution**: Implemented automatic shell escaping for template literal interpolations
- **SSH**: Added support for secure credential handling in SSH adapter

## Previous Releases

See individual package CHANGELOG files for historical releases.