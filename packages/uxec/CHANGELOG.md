# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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