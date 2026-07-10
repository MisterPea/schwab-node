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

## [0.7.1] - 2026-07-10

### Added

- `getAccounts(config?)` now accepts an optional `{ fields: "positions" }` request so callers can fetch account positions from the Schwab `/accounts` endpoint.
- Added account position schemas and exported `GetAccountsRequest` and `Position` types so equity and option holdings can be parsed from account responses.
- Added contract coverage for accounts responses with and without positions, plus zero-bid option spread validation.

### Changed

- `getAccounts()` now validates the optional request config and preserves backward compatibility when account responses omit `positions`.
- `bidAskSpreadPct` in option-return payloads is now `null` when the bid is `0` instead of producing an invalid infinite percentage in `getAtmOptionData()` and `greekFilter()`.

## [0.7.0] - 2026-06-08

### Added

- `getGammaExposure(symbol, startDte, endDte)` — returns per-strike gamma exposure data for stocks and ETFs. Each element includes signed strike GEX, per-contract GEX, moneyness bucket (`NTM`/`ITM`/`OTM`), DTE bucket, delta, IV, and other option fields. Exported from `@misterpea/schwab-node/derivatives` and `@misterpea/schwab-node/derivatives/gamma-tools`.

### Removed

- **Breaking:** Legacy import paths `@misterpea/schwab-node/marketData/quotes`, `/marketData/derivatives`, `/marketData/highLevelData`, and `/marketData/request` have been removed. Use `@misterpea/schwab-node/market-data` and `@misterpea/schwab-node/derivatives` instead.
- **Breaking:** Legacy types removed from the main export: `AtmOptionRtn`, `ChartBase`, `ChartRequest`, `GetAtmOptionReq` (use the one from `./derivatives/get-atm-option-data`), `GetOptionChainRtn`, `GetQuoteReq`, `GreekFilterReq`, `GreekFilterRtn`, `OptionChainReq`, `OptionExpirationReq`, `OptionExpirationRtn`, `PriceHistoryRtnElement`, `QuoteData`, `QuoteRtn`, `ScreenersResponseItem`, and all legacy frequency/period types (`ChartRequest`, `DayPeriod`, `MinuteFrequency`, etc.). Use the Zod-inferred types exported from each module's schema instead.
- `GetMarketDataConfig` in `@misterpea/schwab-node/types_internal` now reflects the current schema types rather than the removed legacy types.

### Security

- Bumped transitive dependency `ws` to 8.20.1 to address GHSA-58qx-3vcg-4xpx (CVE-2026-45736). `ws` ≤8.20.0 could disclose uninitialized memory when a `TypedArray` was passed as the reason argument to `websocket.close()`. This package does not call `close()` with a TypedArray reason directly, but the fix is included as a precaution.
- Bumped transitive dependency `qs` to 6.15.2 to address GHSA-q8mj-m7cp-5q26 (CVE-2026-8723). `qs` ≥6.11.1 and <6.15.2 could crash with a TypeError in `qs.stringify` when `arrayFormat: 'comma'` and `encodeValuesOnly: true` were set on an array containing null or undefined entries, enabling a remotely triggerable DoS via JSON request bodies.

## [0.6.2] - 2026-04-28

### Security

- Bumped transitive dependency `postcss` to 8.5.12 (via `vite`) to address CVE-2026-41305. PostCSS ≤8.5.5 did not escape `</style>` sequences when stringifying CSS ASTs, enabling XSS when user-submitted CSS was embedded in HTML `<style>` tags. This package does not process user CSS directly, but the fix is included as a precaution.

## [0.6.1] - 2026-04-25

### Added

- In-memory token cache for delegated mode (`cachedDelegatedToken`). Repeated `getAuth()` calls return the cached token without hitting the store until it expires.
- `clearAuth()` now also clears the in-memory delegated token cache.
- Tests for delegated mode: cache hit, cache bypass on expiry, cache reset after `clearAuth`, missing token, and basic store read.

### Changed

- README: added disclaimer section linking to `DISCLAIMER.md`.

## [0.6.0] - 2026-04-22

### Added

- Added `tokenMode` config option (`"managed"` | `"delegated"`) to `SchwabAuthConfig`. Default is `"managed"` — existing behavior unchanged.
- Added `createDelegatedAuth(tokenStore)` factory for apps that delegate all OAuth and refresh work to an external daemon.
- Added `TokenMode` type export.

### Changed

- `getAuth()` in delegated mode reads from the provided store and throws on missing or expired token instead of attempting refresh or re-auth.

## [0.5.1] - 2026-04-18

### Added

- Added `HistoricalReplayStreamer` replay controls via `pause()`, `resume()`, `isPaused`, and `replay()`.

### Changed

- Expanded the README with replay control usage for pausing, resuming, and repeating the most recent replay.

### Deprecated

- None yet.

## [0.5.0] - 2026-03-31

### Added

- Added split-based historical replay inputs for file-picker workflows via `inSampleFiles`, optional `preSampleFiles`, and optional `outOfSampleFiles`.
- Added overlapping out-of-sample cascade support through `outOfSampleWindowSize` and `outOfSampleOverlap`.
- Added split replay payload metadata including `baseService`, `sectionLabel`, `sectionIndex`, and `sectionKind`.
- Added tests covering split replay ordering, overlapping out-of-sample windows, missing-file validation, unsupported extensions, and timed split pacing.

### Changed

- `HistoricalReplayStreamer` now publishes split sections on derived services such as `HISTORICAL_CHART_EQUITY_IN_SAMPLE`, `HISTORICAL_CHART_EQUITY_PRE_SAMPLE`, and `HISTORICAL_CHART_EQUITY_OO_SAMPLE_1`.
- Expanded the README with the new file-picker replay flow and split replay configuration details.

### Deprecated

- Deprecated `filePath` as the preferred historical replay input in favor of the split-based file array API for new integrations, while keeping legacy single-file replay supported.

## [0.4.1] - 2026-03-30

### Added

- Added `resolveSchwabPaths()` and public path types so auth, token, and cert locations can be overridden from one package-owned resolver.
- Added injectable `TokenStore`, `TokenCipher`, and `EncryptedFileTokenStore` interfaces for secure host-managed token persistence.
- Added tests covering path resolution, custom token storage, env-path overrides, and cert setup path overrides.

### Changed

- `SchwabAuth` can now resolve credentials from direct config, injected secret providers, or an overridden env file path.
- The cert setup flow now uses the same path resolver as auth and supports `--env-path` and `--storage-root`.
- Expanded the README with path override and secure token storage examples.

## [0.4.0] - 2026-03-28

### Added

- Added `HistoricalReplayStreamer` for replaying file-backed OHLCV data through the ZeroMQ interface.
- Added explicit historical stream services including `HISTORICAL_CHART_EQUITY` and `HISTORICAL_CHART_FUTURES` so downstream consumers can distinguish replay from live data.
- Added historical replay normalization for the current JSONL and CSV fixture formats, including symbol resolution, timestamp conversion, and scaled-price conversion.
- Added tests covering historical replay normalization, topic publishing, and timed replay pacing.

### Changed

- Expanded the README with historical replay usage, configuration, and message-shape documentation.

## [0.3.1] - 2026-03-27

### Changed

- Updated locked dependencies to include the latest Dependabot security fix refresh.

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
