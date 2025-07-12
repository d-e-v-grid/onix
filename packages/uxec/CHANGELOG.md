# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2025-07-12

### Fixed
- **Documentation**: Updated version information and changelog consistency
- **Build**: Ensured proper TypeScript compilation

### Changed
- **Version**: Bumped version to 0.1.1 for patch release

## [0.1.0] - 2025-07-12

### Added
- **Core**: Full zx compatibility features in ProcessPromise:
  - `text()` method to get trimmed stdout as string
  - `json()` method to parse stdout as JSON
  - `lines()` method to get stdout as array of lines
  - `buffer()` method to get stdout as Buffer
  - `kill()` method to terminate processes
  - `exitCode` property to get process exit code
- **Core**: Enhanced pipe() method with support for:
  - Template strings for piping to new commands
  - NodeJS WritableStream targets
  - Proper stream chaining
- **Core**: Synchronous execution support:
  - `executeSync()` method in BaseAdapter
  - Full implementation in LocalAdapter for both Node.js and Bun
- **Core**: Improved timeout handling with custom signal support
- **Core**: Interactive mode support for TTY operations
- **Adapters**: Enhanced stream handling and process management
- **Compatibility**: Full API compatibility with Google zx v8

### Changed
- **Core**: ProcessPromise interface extended with zx-compatible methods
- **Core**: Command interface now includes `timeoutSignal` option
- **Core**: Improved error handling and propagation in pipelines

### Fixed
- **Core**: Stream handling in pipe operations
- **Core**: Process cleanup on timeout and abort

## [0.0.3] - 2025-07-12

### Fixed
- **Local Adapter**: Added missing `override` modifier to `executeSync` method
- **Execution Engine**: Fixed pipe functionality to handle array-based command templates correctly
- **Execution Engine**: Fixed kill method to properly dispatch abort events on AbortSignal
- **Build**: Fixed TypeScript compilation errors related to type mismatches
- **Testing**: Added new tests for executeSync functionality
- **Testing**: All tests now pass successfully

### Improved
- **Code Quality**: Enhanced TypeScript type safety and consistency across adapters
- **Documentation**: Updated changelog and version tracking

## [0.0.2] - 2025-07-12

### Added
- **Core**: Initial unified execution engine implementation
- **Adapters**: Multiple execution adapters support:
  - Local adapter for direct command execution
  - SSH adapter for remote command execution
  - Docker adapter for containerized execution
  - Mock adapter for testing purposes
- **Core**: Comprehensive command execution framework with streaming support
- **Core**: Robust error handling and result management
- **Core**: Stream handler for real-time command output processing
- **Utils**: Runtime detection utilities
- **Utils**: Shell escaping utilities for secure command construction
- **Utils**: Process utilities for command execution management
- **SSH**: SSH connection management and file operations
- **Testing**: Comprehensive test suite with unit and integration tests
- **Testing**: Mock factories and test helpers
- **Testing**: Spec compliance testing framework

### Changed
- **Package**: Renamed from `uexec` to `uxec` for better naming consistency
- **Architecture**: Modular adapter-based architecture for extensible execution environments

## [0.0.1] - 2025-07-12

### Added
- **Project**: Initial project setup and structure