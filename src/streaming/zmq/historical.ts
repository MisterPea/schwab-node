import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Publisher } from "zeromq";
import { createPublisher, publish } from "./publisher.js";
import {
  HistoricalReplayConfigSchema,
  HistoricalReplayFormatSchema,
  type HistoricalChartRecord,
  type HistoricalPublishedMessage,
  type HistoricalReplayConfig,
  type HistoricalReplayFormat,
  type HistoricalReplayPace,
  type HistoricalStreamService,
} from "./historicalSchema.js";

const DEFAULT_PUBLISHER_ADDRESS = "tcp://*:5555";
const DEFAULT_TOPIC_PREFIX = "schwab";
const CSV_PRICE_SCALE = 1_000_000_000;

type HistoricalReplayStreamerOptions = {
  publisherAddress?: string;
  topicPrefix?: string;
};

type JsonlRow = {
  symbol?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
  datetime?: unknown;
};

type CsvRow = {
  symbol?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  ts_event?: string;
};

/**
 * Delays execution for a given number of milliseconds.
 *
 * @param ms Milliseconds to wait.
 * @returns A promise that resolves after the delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Coerces a value into a finite number for historical replay parsing.
 *
 * @param value Raw value from a historical data source.
 * @param fieldName Field name used for error reporting.
 * @returns The parsed numeric value.
 * @throws {Error} When the value cannot be converted to a finite number.
 */
function toNumber(value: unknown, fieldName: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid historical ${fieldName} value: ${String(value)}`);
  }

  return parsed;
}

/**
 * Detects the historical replay file format from its filename extension.
 *
 * @param filePath Path to the source file.
 * @returns The inferred replay format.
 * @throws {Error} When the file extension is unsupported.
 */
function detectFormat(filePath: string): HistoricalReplayFormat {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".jsonl") return "jsonl";
  if (ext === ".csv") return "csv";

  throw new Error(`Unsupported historical file format for "${filePath}"`);
}

/**
 * Attempts to infer a symbol from the historical source filename.
 *
 * Supports common names such as `AAPL.jsonl`, `prices.AAPL.csv`, or
 * `ES-202403.csv`.
 *
 * @param filePath Path to the source file.
 * @returns The inferred uppercase symbol, if one can be determined.
 */
function inferSymbolFromFilename(filePath: string): string | undefined {
  const baseName = path.basename(filePath, path.extname(filePath));
  const dotMatch = baseName.match(/(?:^|\.)([A-Z][A-Z0-9/_.-]{0,31})(?:$|\.)/);

  if (dotMatch?.[1]) {
    return dotMatch[1].toUpperCase();
  }

  const hyphenMatch = baseName.match(/^([A-Za-z][A-Za-z0-9/_.-]{0,31})-/);
  if (hyphenMatch?.[1]) {
    return hyphenMatch[1].toUpperCase();
  }

  return undefined;
}

/**
 * Resolves the symbol for a historical record using, in order, the row value,
 * configured fallback symbol, and filename inference.
 *
 * @param rowSymbol Symbol value from the source row.
 * @param configSymbol Optional symbol supplied in replay configuration.
 * @param filePath Path to the source file, used for inference.
 * @returns The resolved uppercase symbol.
 * @throws {Error} When no symbol can be resolved.
 */
function resolveSymbol(
  rowSymbol: unknown,
  configSymbol: string | undefined,
  filePath: string,
): string {

  if (typeof rowSymbol === "string" && rowSymbol.trim()) {
    return rowSymbol.trim().toUpperCase();
  }

  if (configSymbol?.trim()) {
    return configSymbol.trim().toUpperCase();
  }

  const inferred = inferSymbolFromFilename(filePath);
  if (inferred) return inferred;

  throw new Error(
    `Unable to resolve symbol for historical data source "${filePath}"`,
  );
}

/**
 * Normalizes a parsed JSONL row into the published historical chart shape.
 *
 * @param row Parsed JSONL row.
 * @param config Validated replay configuration.
 * @returns A normalized historical chart record.
 */
function normalizeJsonlRow(
  row: JsonlRow,
  config: HistoricalReplayConfig,
): HistoricalChartRecord {
  return {
    symbol: resolveSymbol(row.symbol, config.symbol, config.filePath),
    openPrice: toNumber(row.open, "open"),
    highPrice: toNumber(row.high, "high"),
    lowPrice: toNumber(row.low, "low"),
    closePrice: toNumber(row.close, "close"),
    volume: toNumber(row.volume, "volume"),
    chartTime: Math.trunc(toNumber(row.datetime, "datetime")),
  };
}

/**
 * Parses a CSV data line using a header row as the column map.
 *
 * This parser assumes comma-separated values without quoted comma escaping,
 * which matches the expected historical export format.
 *
 * @param header CSV header columns.
 * @param line Raw CSV data line.
 * @returns A row object keyed by header name.
 */
function parseCsvLine(header: string[], line: string): CsvRow {
  const values = line.split(",");
  const row: Record<string, string> = {};

  for (const [index, key] of header.entries()) {
    row[key] = values[index] ?? "";
  }

  return row;
}

/**
 * Normalizes a CSV row into the published historical chart shape.
 *
 * Price fields are scaled down from the upstream integer representation and
 * timestamps are converted from nanoseconds to epoch milliseconds.
 *
 * @param row Parsed CSV row.
 * @param config Validated replay configuration.
 * @returns A normalized historical chart record.
 */
function normalizeCsvRow(
  row: CsvRow,
  config: HistoricalReplayConfig,
): HistoricalChartRecord {
  return {
    symbol: resolveSymbol(row.symbol, config.symbol, config.filePath),
    openPrice: toNumber(row.open, "open") / CSV_PRICE_SCALE,
    highPrice: toNumber(row.high, "high") / CSV_PRICE_SCALE,
    lowPrice: toNumber(row.low, "low") / CSV_PRICE_SCALE,
    closePrice: toNumber(row.close, "close") / CSV_PRICE_SCALE,
    volume: toNumber(row.volume, "volume"),
    chartTime: Math.trunc(toNumber(row.ts_event, "ts_event") / 1_000_000),
  };
}

/**
 * Loads and normalizes historical chart records from a JSONL or CSV source.
 *
 * The replay format is taken from `rawConfig.format` when present and otherwise
 * inferred from the file extension.
 *
 * @param rawConfig Historical replay configuration.
 * @returns Normalized chart records ready for publishing.
 */
export async function loadHistoricalRecords(
  rawConfig: HistoricalReplayConfig,
): Promise<HistoricalChartRecord[]> {
  const config = HistoricalReplayConfigSchema.parse(rawConfig);
  const format = config.format ?? detectFormat(config.filePath);
  const rawText = await readFile(config.filePath, "utf8");
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (format === "jsonl") {
    return lines.map((line) => {
      const row = JSON.parse(line) as JsonlRow;
      return normalizeJsonlRow(row, config);
    });
  }

  const [headerLine, ...dataLines] = lines;
  if (!headerLine) return [];

  const header = headerLine
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  return dataLines.map((line) => normalizeCsvRow(parseCsvLine(header, line), config));
}

/**
 * Builds the ZeroMQ topic used for historical replay messages.
 *
 * @param topicPrefix Configured topic prefix.
 * @param service Historical stream service name.
 * @returns The fully qualified publish topic.
 */
export function historicalTopicFor(
  topicPrefix: string,
  service: HistoricalStreamService,
): string {
  return `${topicPrefix}.data.${service}`;
}

/**
 * Publishes a single normalized historical chart record as a replay message.
 *
 * @param sock Connected ZeroMQ publisher socket.
 * @param topicPrefix Configured topic prefix.
 * @param service Historical stream service name.
 * @param record Historical chart record to publish.
 * @param source Source label included in the payload.
 * @param replayMode Replay pacing mode associated with the message.
 * @returns A promise that resolves once the message has been published.
 */
export async function publishHistoricalRecord(
  sock: Publisher,
  topicPrefix: string,
  service: HistoricalStreamService,
  record: HistoricalChartRecord,
  source: string,
  replayMode: HistoricalReplayPace,
): Promise<void> {
  const message: HistoricalPublishedMessage = {
    type: "data",
    receivedAt: Date.now(),
    payload: {
      service,
      command: "REPLAY",
      content: [record],
      source,
      replayMode,
    },
  };

  await publish(sock, historicalTopicFor(topicPrefix, service), message);
}

/**
 * Streams historical chart data through the ZeroMQ publisher used by the live
 * adapter, allowing recorded data to be replayed as synthetic `data` messages.
 */
export class HistoricalReplayStreamer {
  private publisher: Publisher | null = null;
  private readonly publisherAddress: string;
  private readonly topicPrefix: string;

  /**
   * Creates a historical replay publisher with optional address and topic overrides.
   *
   * @param options Connection options for the replay publisher.
   */
  constructor(options: HistoricalReplayStreamerOptions = {}) {
    this.publisherAddress =
      options.publisherAddress ?? DEFAULT_PUBLISHER_ADDRESS;
    this.topicPrefix = options.topicPrefix ?? DEFAULT_TOPIC_PREFIX;
  }

  /**
   * Connects the replay publisher if it is not already connected.
   *
   * @returns A promise that resolves once the publisher is ready.
   */
  async connect(): Promise<void> {
    if (this.publisher) return;
    this.publisher = await createPublisher(this.publisherAddress);
  }

  /**
   * Closes the replay publisher when connected.
   *
   * @returns A promise that resolves once the socket has been closed.
   */
  async close(): Promise<void> {
    if (!this.publisher) return;
    await this.publisher.close();
    this.publisher = null;
  }

  /**
   * Replays all records from a historical source file.
   *
   * In `burst` mode, records are published back-to-back. In `timed` mode, the
   * delay between records is derived from adjacent `chartTime` values and
   * divided by the configured replay `speed`.
   *
   * @param rawConfig Historical replay configuration.
   * @returns A promise that resolves after the full replay has completed.
   */
  async replayFile(rawConfig: HistoricalReplayConfig): Promise<void> {
    const config = HistoricalReplayConfigSchema.parse(rawConfig);
    await this.connect();

    const sock = this.publisher;
    if (!sock) {
      throw new Error("Historical replay publisher is not connected");
    }

    const records = await loadHistoricalRecords(config);
    const speed = config.speed ?? 1;

    for (const [index, record] of records.entries()) {
      if (config.pace === "timed" && index > 0) {
        const prior = records[index - 1];
        const deltaMs = Math.max(0, record.chartTime - prior.chartTime);
        if (deltaMs > 0) {
          await sleep(deltaMs / speed);
        }
      }

      await publishHistoricalRecord(
        sock,
        this.topicPrefix,
        config.service,
        record,
        path.basename(config.filePath),
        config.pace,
      );
    }
  }
}

export {
  detectFormat as detectHistoricalReplayFormat,
  HistoricalReplayConfigSchema,
  HistoricalReplayFormatSchema,
};
export type { HistoricalReplayStreamerOptions };
