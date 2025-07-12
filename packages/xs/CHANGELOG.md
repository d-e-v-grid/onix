# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Core**: Migrated execution backend from native implementation to @onix-js/uxec
- **Architecture**: xs now runs on top of uxec unified execution engine
- **Compatibility**: Maintained full API compatibility with zx while using uxec backend

### Added
- **Integration**: Added uxec-adapter.ts for seamless integration with uxec
- **Adapters**: Support for multiple execution environments through uxec:
  - Local command execution
  - SSH remote execution
  - Docker container execution
- **Tests**: Added test-uxec.mjs to verify uxec backend functionality

### Technical Details
- Replaced native ProcessPromise implementation with XsProcessPromise from uxec
- Updated core.ts to use createUxecShell from uxec-adapter
- Added compatibility layer for globals (ProcessPromise, kill, syncProcessCwd, etc.)
- Ensured lazy execution for proper nothrow() and quiet() method support
- Fixed sync function preservation during shell initialization

## [8.7.0] - Previous Release
- Original zx implementation