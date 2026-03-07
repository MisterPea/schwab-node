# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- None yet.

### Changed

- None yet.

### Deprecated

- None yet.

## [0.3.0] - 2026-03-07

### Added

- Added `SchwabStreamer` with websocket schemas and field maps for streaming subscriptions.
- Added ZeroMQ publisher/subscriber helpers and adapter utilities for streaming delivery.
- Added the `@misterpea/schwab-node/streaming/zmq` public export path.
- Added root exports for `createSubscriber`, `listen`, and the `zmq` namespace.
- Added tests covering streaming websocket and ZeroMQ adapter behavior.

### Changed

- `getQuote` now accepts `symbols` as `string[]` in addition to comma-delimited `string` (backward compatible).
- Added a `useAdapter` option to streaming so adapter mapping can be bypassed when needed.
- Updated request module structure and refreshed docs.
- Reorganized the README around quickstart, streaming flow, and current import paths.

## [0.2.0] - 2026-02-28

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
