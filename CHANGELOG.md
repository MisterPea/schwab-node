# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Added a compatibility bridge for legacy `marketData/*` import routes so older consumers can continue importing while migrating to the current package structure.
- Added one-time deprecation warnings for legacy import routes, pointing callers to the current kebab-case namespace paths.
- Added compatibility exports for legacy `types` and `types_internal` entrypoints.
- Added package subpath exports for the current namespace layout and legacy compatibility routes.
- Added migration guidance to the README for import path changes.
- Added tests covering the legacy route bridge behavior.

### Changed

- Updated package documentation to reflect the current public API, current return shapes, and current import paths.

### Deprecated

- Deprecated the legacy `@misterpea/schwab-node/marketData/quotes` route in favor of `@misterpea/schwab-node/market-data`.
- Deprecated the legacy `@misterpea/schwab-node/marketData/highLevelData` route in favor of `@misterpea/schwab-node/market-data`.
- Deprecated the legacy `@misterpea/schwab-node/marketData/derivatives` route in favor of `@misterpea/schwab-node/derivatives`.
- Deprecated the legacy `@misterpea/schwab-node/marketData/request` route in favor of `@misterpea/schwab-node/scripts/request`.

## [0.1.0]

### Added

- Initial release.
