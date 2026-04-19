import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Publisher } from "zeromq";
import { createPublisher, publish } from "./publisher.js";
import {
  HistoricalBaseStreamServiceSchema,
  HistoricalReplayConfigSchema,
  HistoricalReplayFormatSchema,
  type HistoricalChartRecord,
  type HistoricalBaseStreamService,
  type HistoricalPublishedMessage,
  type HistoricalReplayConfig,
  type HistoricalReplayFormat,
  type HistoricalReplayPace,
  type HistoricalReplaySectionKind,
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

type HistoricalReplaySection = {
  service: HistoricalStreamService;
  label: string;
  kind: HistoricalReplaySectionKind;
  index: number;
  files: string[];
};

type HistoricalRecordLoadContext = {
  filePath: string;
  format?: HistoricalReplayFormat;
  symbol?: string;
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
  config: HistoricalRecordLoadContext,
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
  config: HistoricalRecordLoadContext,
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
  if (!config.filePath) {
    throw new Error("`loadHistoricalRecords` requires `filePath` in legacy mode");
  }

  return loadHistoricalRecordsFromFile(config.filePath, config);
}

async function loadHistoricalRecordsFromFile(
  filePath: string,
  config: Pick<HistoricalReplayConfig, "format" | "symbol">,
): Promise<HistoricalChartRecord[]> {
  const loadContext: HistoricalRecordLoadContext = {
    filePath,
    format: config.format,
    symbol: config.symbol,
  };
  const format = loadContext.format ?? detectFormat(filePath);
  const rawText = await readFile(filePath, "utf8");
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (format === "jsonl") {
    return lines.map((line) => {
      const row = JSON.parse(line) as JsonlRow;
      return normalizeJsonlRow(row, loadContext);
    });
  }

  const [headerLine, ...dataLines] = lines;
  if (!headerLine) return [];

  const header = headerLine
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  return dataLines.map((line) =>
    normalizeCsvRow(parseCsvLine(header, line), loadContext),
  );
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
  metadata?: {
    baseService?: HistoricalBaseStreamService;
    sectionLabel?: string;
    sectionIndex?: number;
    sectionKind?: HistoricalReplaySectionKind;
  },
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
      ...metadata,
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
  private _paused = false;
  private _pauseGate: Promise<void> | null = null;
  private _pauseResolve: (() => void) | null = null;
  private _lastConfig: HistoricalReplayConfig | null = null;

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

  get isPaused(): boolean {
    return this._paused;
  }

  pause(): void {
    if (this._paused) return;

    this._paused = true;
    this._pauseGate = new Promise((resolve) => {
      this._pauseResolve = resolve;
    });
  }

  resume(): void {
    if (!this._paused) return;

    this._paused = false;
    this._pauseResolve?.();
    this._pauseResolve = null;
    this._pauseGate = null;
  }

  async replay(): Promise<void> {
    if (!this._lastConfig) {
      throw new Error("No prior replay to repeat — call replayFile() first");
    }

    return this.replayFile(this._lastConfig);
  }

  private async waitIfPaused(): Promise<void> {
    if (this._pauseGate) {
      await this._pauseGate;
    }
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
    this._lastConfig = rawConfig;
    await this.connect();

    const sock = this.publisher;
    if (!sock) {
      throw new Error("Historical replay publisher is not connected");
    }

    if (config.filePath) {
      await assertReplayFile(config.filePath);
      const records = await loadHistoricalRecords(config);
      await this.publishSectionRecords(sock, config.service, records, {
        source: path.basename(config.filePath),
        pace: config.pace,
        speed: config.speed,
      });
      return;
    }

    const sections = buildReplaySections(config);
    const files = sections.flatMap((section) => section.files);
    await Promise.all(files.map((filePath) => assertReplayFile(filePath)));

    for (const section of sections) {
      const records = await loadRecordsForFiles(section.files, config);
      await this.publishSectionRecords(sock, section.service, records, {
        source: section.files.map((filePath) => path.basename(filePath)).join(","),
        pace: config.pace,
        speed: config.speed,
        metadata: {
          baseService: config.service,
          sectionKind: section.kind,
          sectionLabel: section.label,
          sectionIndex: section.index,
        },
      });
    }
  }

  private async publishSectionRecords(
    sock: Publisher,
    service: HistoricalStreamService,
    records: HistoricalChartRecord[],
    options: {
      source: string;
      pace: HistoricalReplayPace;
      speed?: number;
      metadata?: {
        baseService?: HistoricalBaseStreamService;
        sectionLabel?: string;
        sectionIndex?: number;
        sectionKind?: HistoricalReplaySectionKind;
      };
    },
  ): Promise<void> {
    const speed = options.speed ?? 1;

    for (const [index, record] of records.entries()) {
      await this.waitIfPaused();

      if (options.pace === "timed" && index > 0) {
        const prior = records[index - 1];
        const deltaMs = Math.max(0, record.chartTime - prior.chartTime);
        if (deltaMs > 0) {
          await sleep(deltaMs / speed);
        }
      }

      await publishHistoricalRecord(
        sock,
        this.topicPrefix,
        service,
        record,
        options.source,
        options.pace,
        options.metadata,
      );
    }
  }
}

async function assertReplayFile(filePath: string): Promise<void> {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`Historical replay file does not exist: "${filePath}"`);
  }

  detectFormat(filePath);
}

async function loadRecordsForFiles(
  filePaths: string[],
  config: Pick<HistoricalReplayConfig, "format" | "symbol">,
): Promise<HistoricalChartRecord[]> {
  const batches = await Promise.all(
    filePaths.map((filePath) => loadHistoricalRecordsFromFile(filePath, config)),
  );

  return batches.flat();
}

function buildReplaySections(
  config: HistoricalReplayConfig,
): HistoricalReplaySection[] {
  const sections: HistoricalReplaySection[] = [];

  if (config.preSampleFiles?.length) {
    sections.push({
      service: `${config.service}_PRE_SAMPLE`,
      label: "PRE_SAMPLE",
      kind: "pre_sample",
      index: 1,
      files: config.preSampleFiles,
    });
  }

  sections.push({
    service: `${config.service}_IN_SAMPLE`,
    label: "IN_SAMPLE",
    kind: "in_sample",
    index: 1,
    files: config.inSampleFiles ?? [],
  });

  if (config.outOfSampleFiles?.length) {
    sections.push(
      ...buildOutOfSampleSections(
        config.service,
        config.outOfSampleFiles,
        config.outOfSampleWindowSize ?? 1,
        config.outOfSampleOverlap ?? 0,
      ),
    );
  }

  return sections;
}

function buildOutOfSampleSections(
  service: HistoricalBaseStreamService,
  files: string[],
  windowSize: number,
  overlap: number,
): HistoricalReplaySection[] {
  const sections: HistoricalReplaySection[] = [];
  const step = windowSize - overlap;

  for (
    let startIndex = 0, sectionIndex = 1;
    startIndex < files.length;
    startIndex += step, sectionIndex += 1
  ) {
    const windowFiles = files.slice(startIndex, startIndex + windowSize);
    if (windowFiles.length === 0) continue;

    sections.push({
      service: `${service}_OO_SAMPLE_${sectionIndex}`,
      label: `OO_SAMPLE_${sectionIndex}`,
      kind: "out_of_sample",
      index: sectionIndex,
      files: windowFiles,
    });

    if (startIndex + windowSize >= files.length) {
      break;
    }
  }

  return sections;
}

export {
  detectFormat as detectHistoricalReplayFormat,
  HistoricalBaseStreamServiceSchema,
  HistoricalReplayConfigSchema,
  HistoricalReplayFormatSchema,
};
export type { HistoricalReplayStreamerOptions };
