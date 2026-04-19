import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockCreatePublisher, mockPublish } = vi.hoisted(() => ({
  mockCreatePublisher: vi.fn(),
  mockPublish: vi.fn(),
}));

vi.mock("../src/streaming/zmq/publisher.js", () => ({
  createPublisher: mockCreatePublisher,
  publish: mockPublish,
}));

const FIXTURES_DIR = path.resolve(process.cwd(), "test/historicalData");

async function loadHistoricalModule() {
  return import("../src/streaming/zmq/historical.js");
}

async function createHistoricalFile(
  dir: string,
  fileName: string,
  chartTime: number,
): Promise<string> {
  const filePath = path.join(dir, fileName);
  await writeFile(
    filePath,
    JSON.stringify({
      symbol: "SPY",
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 10,
      datetime: chartTime,
    }),
  );

  return filePath;
}

beforeEach(() => {
  mockCreatePublisher.mockReset();
  mockPublish.mockReset();
  mockCreatePublisher.mockResolvedValue({
    close: vi.fn().mockResolvedValue(undefined),
  });
  mockPublish.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("historical replay normalization", () => {
  test("loads JSONL records and preserves row symbols", async () => {
    const { loadHistoricalRecords } = await loadHistoricalModule();
    const records = await loadHistoricalRecords({
      filePath: path.join(FIXTURES_DIR, "synthetic-bars-1s-with-symbol.jsonl"),
    });

    expect(records[0]).toEqual({
      symbol: "TESTEQ",
      openPrice: 50.1,
      highPrice: 50.2,
      lowPrice: 50,
      closePrice: 50.15,
      volume: 10,
      chartTime: 1801000000000,
    });
  });

  test("loads JSONL records and fills symbol from config when missing", async () => {
    const { loadHistoricalRecords } = await loadHistoricalModule();
    const records = await loadHistoricalRecords({
      filePath: path.join(FIXTURES_DIR, "synthetic-bars-1m-no-symbol.jsonl"),
      symbol: "testsym",
    });

    expect(records[0]).toEqual({
      symbol: "TESTSYM",
      openPrice: 100.1,
      highPrice: 100.4,
      lowPrice: 99.9,
      closePrice: 100.2,
      volume: 120,
      chartTime: 1800000000000,
    });
  });

  test("loads CSV records with scaled price and timestamp conversion", async () => {
    const { loadHistoricalRecords } = await loadHistoricalModule();
    const records = await loadHistoricalRecords({
      filePath: path.join(FIXTURES_DIR, "synthetic-bars-1m-vendor.csv"),
    });

    expect(records[0]).toEqual({
      symbol: "TESTCSV",
      openPrice: 101.25,
      highPrice: 101.5,
      lowPrice: 101,
      closePrice: 101.4,
      volume: 300,
      chartTime: 1802000000000,
    });
  });

  test("fails fast when no symbol can be resolved", async () => {
    const { loadHistoricalRecords } = await loadHistoricalModule();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "historical-nosymbol-"));
    const filePath = path.join(tempDir, "12345.jsonl");

    await writeFile(
      filePath,
      JSON.stringify({
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 100,
        datetime: 1803000000000,
      }),
    );

    await expect(
      loadHistoricalRecords({
        filePath,
      }),
    ).rejects.toThrow("Unable to resolve symbol");
  });
});

describe("HistoricalReplayStreamer", () => {
  test("publishes on historical topics with historical services", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await streamer.replayFile({
      filePath: path.join(FIXTURES_DIR, "synthetic-bars-1m-vendor.csv"),
      service: "HISTORICAL_CHART_EQUITY",
    });

    expect(mockCreatePublisher).toHaveBeenCalledWith("tcp://*:5555");
    expect(mockPublish).toHaveBeenCalled();

    const [sock, topic, message] = mockPublish.mock.calls[0] as [
      unknown,
      string,
      {
        type: string;
        payload: {
          service: string;
          command: string;
          replayMode: string;
          source: string;
          content: Array<Record<string, unknown>>;
        };
      },
    ];

    expect(sock).toBeTruthy();
    expect(topic).toBe("schwab.data.HISTORICAL_CHART_EQUITY");
    expect(message.type).toBe("data");
    expect(message.payload.service).toBe("HISTORICAL_CHART_EQUITY");
    expect(message.payload.command).toBe("REPLAY");
    expect(message.payload.replayMode).toBe("burst");
    expect(message.payload.source).toBe("synthetic-bars-1m-vendor.csv");
    expect(message.payload.content[0]).toMatchObject({
      symbol: "TESTCSV",
      openPrice: 101.25,
      chartTime: 1802000000000,
    });
  });

  test("supports timed replay pacing", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "historical-replay-"));
    const filePath = path.join(tempDir, "timed-sample.jsonl");

    await writeFile(
      filePath,
      [
        JSON.stringify({
          symbol: "SPY",
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 10,
          datetime: 1_000,
        }),
        JSON.stringify({
          symbol: "SPY",
          open: 101,
          high: 102,
          low: 100,
          close: 101.5,
          volume: 15,
          datetime: 2_000,
        }),
      ].join("\n"),
    );

    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();
    const setTimeoutSpy = vi
      .spyOn(global, "setTimeout")
      .mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === "function") {
          handler();
        }
        return 0 as unknown as NodeJS.Timeout;
      }) as typeof setTimeout);

    await streamer.replayFile({
      filePath,
      service: "HISTORICAL_CHART_EQUITY",
      pace: "timed",
      speed: 2,
    });

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  test("supports timed pacing for split in-sample replay", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "historical-split-timed-"),
    );
    const first = await createHistoricalFile(tempDir, "in-1.jsonl", 1_000);
    const second = await createHistoricalFile(tempDir, "in-2.jsonl", 2_000);
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();
    const setTimeoutSpy = vi
      .spyOn(global, "setTimeout")
      .mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === "function") {
          handler();
        }
        return 0 as unknown as NodeJS.Timeout;
      }) as typeof setTimeout);

    await streamer.replayFile({
      service: "HISTORICAL_CHART_EQUITY",
      inSampleFiles: [first, second],
      pace: "timed",
      speed: 2,
    });

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  test("publishes in-sample files on the split-specific service", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "historical-split-"));
    const first = await createHistoricalFile(tempDir, "in-1.jsonl", 1_000);
    const second = await createHistoricalFile(tempDir, "in-2.jsonl", 2_000);
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await streamer.replayFile({
      service: "HISTORICAL_CHART_EQUITY",
      inSampleFiles: [first, second],
    });

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish.mock.calls[0]?.[1]).toBe(
      "schwab.data.HISTORICAL_CHART_EQUITY_IN_SAMPLE",
    );

    const firstMessage = mockPublish.mock.calls[0]?.[2] as {
      payload: Record<string, unknown>;
    };

    expect(firstMessage.payload.service).toBe(
      "HISTORICAL_CHART_EQUITY_IN_SAMPLE",
    );
    expect(firstMessage.payload.baseService).toBe("HISTORICAL_CHART_EQUITY");
    expect(firstMessage.payload.sectionKind).toBe("in_sample");
    expect(firstMessage.payload.sectionLabel).toBe("IN_SAMPLE");
    expect(firstMessage.payload.sectionIndex).toBe(1);
  });

  test("publishes pre-sample files before in-sample files", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "historical-pre-in-split-"),
    );
    const pre = await createHistoricalFile(tempDir, "pre-1.jsonl", 500);
    const ins = await createHistoricalFile(tempDir, "in-1.jsonl", 1_000);
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await streamer.replayFile({
      service: "HISTORICAL_CHART_EQUITY",
      preSampleFiles: [pre],
      inSampleFiles: [ins],
    });

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish.mock.calls[0]?.[1]).toBe(
      "schwab.data.HISTORICAL_CHART_EQUITY_PRE_SAMPLE",
    );
    expect(mockPublish.mock.calls[1]?.[1]).toBe(
      "schwab.data.HISTORICAL_CHART_EQUITY_IN_SAMPLE",
    );
  });

  test("builds overlapping out-of-sample cascades", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "historical-oos-"));
    const oosFiles = await Promise.all([
      createHistoricalFile(tempDir, "oos-1.jsonl", 1_000),
      createHistoricalFile(tempDir, "oos-2.jsonl", 2_000),
      createHistoricalFile(tempDir, "oos-3.jsonl", 3_000),
      createHistoricalFile(tempDir, "oos-4.jsonl", 4_000),
    ]);
    const inSample = await createHistoricalFile(tempDir, "in-1.jsonl", 900);
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await streamer.replayFile({
      service: "HISTORICAL_CHART_EQUITY",
      inSampleFiles: [inSample],
      outOfSampleFiles: oosFiles,
      outOfSampleWindowSize: 3,
      outOfSampleOverlap: 1,
    });

    const topics = mockPublish.mock.calls.map((call) => call[1]);
    expect(topics).toEqual([
      "schwab.data.HISTORICAL_CHART_EQUITY_IN_SAMPLE",
      "schwab.data.HISTORICAL_CHART_EQUITY_OO_SAMPLE_1",
      "schwab.data.HISTORICAL_CHART_EQUITY_OO_SAMPLE_1",
      "schwab.data.HISTORICAL_CHART_EQUITY_OO_SAMPLE_1",
      "schwab.data.HISTORICAL_CHART_EQUITY_OO_SAMPLE_2",
      "schwab.data.HISTORICAL_CHART_EQUITY_OO_SAMPLE_2",
    ]);

    const firstOosMessage = mockPublish.mock.calls[1]?.[2] as {
      payload: Record<string, unknown>;
    };
    const secondOosMessage = mockPublish.mock.calls[4]?.[2] as {
      payload: Record<string, unknown>;
    };

    expect(firstOosMessage.payload.sectionLabel).toBe("OO_SAMPLE_1");
    expect(firstOosMessage.payload.sectionIndex).toBe(1);
    expect(firstOosMessage.payload.sectionKind).toBe("out_of_sample");
    expect(secondOosMessage.payload.sectionLabel).toBe("OO_SAMPLE_2");
    expect(secondOosMessage.payload.sectionIndex).toBe(2);
  });

  test("rejects split configs without required in-sample files", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await expect(
      streamer.replayFile({
        service: "HISTORICAL_CHART_EQUITY",
        preSampleFiles: [
          path.join(FIXTURES_DIR, "synthetic-bars-1s-with-symbol.jsonl"),
        ],
      }),
    ).rejects.toThrow("`inSampleFiles` is required for split replay mode");
  });

  test("rejects mixed legacy and split replay config", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await expect(
      streamer.replayFile({
        filePath: path.join(FIXTURES_DIR, "synthetic-bars-1m-vendor.csv"),
        service: "HISTORICAL_CHART_EQUITY",
        inSampleFiles: [
          path.join(FIXTURES_DIR, "synthetic-bars-1s-with-symbol.jsonl"),
        ],
      }),
    ).rejects.toThrow("`filePath` cannot be combined with split replay fields");
  });

  test("rejects invalid out-of-sample overlap configuration", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await expect(
      streamer.replayFile({
        service: "HISTORICAL_CHART_EQUITY",
        inSampleFiles: [
          path.join(FIXTURES_DIR, "synthetic-bars-1s-with-symbol.jsonl"),
        ],
        outOfSampleFiles: [
          path.join(FIXTURES_DIR, "synthetic-bars-1m-no-symbol.jsonl"),
        ],
        outOfSampleWindowSize: 2,
        outOfSampleOverlap: 2,
      }),
    ).rejects.toThrow(
      "`outOfSampleOverlap` must be less than `outOfSampleWindowSize`",
    );
  });

  test("rejects split replay when a selected file is missing", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await expect(
      streamer.replayFile({
        service: "HISTORICAL_CHART_EQUITY",
        inSampleFiles: [path.join(FIXTURES_DIR, "missing-file.jsonl")],
      }),
    ).rejects.toThrow("Historical replay file does not exist");
  });

  test("rejects split replay when a selected file has an unsupported extension", async () => {
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "historical-unsupported-"),
    );
    const unsupportedPath = path.join(tempDir, "notes.txt");
    await writeFile(unsupportedPath, "not historical data");
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await expect(
      streamer.replayFile({
        service: "HISTORICAL_CHART_EQUITY",
        inSampleFiles: [unsupportedPath],
      }),
    ).rejects.toThrow("Unsupported historical file format");
  });

  test("pause sets isPaused and resume clears it; idempotent calls are safe", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    expect(streamer.isPaused).toBe(false);

    streamer.pause();
    expect(streamer.isPaused).toBe(true);

    streamer.pause();
    expect(streamer.isPaused).toBe(true);

    streamer.resume();
    expect(streamer.isPaused).toBe(false);

    streamer.resume();
    expect(streamer.isPaused).toBe(false);
  });

  test("pause blocks publishing until resumed", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "historical-pause-"));
    const filePath = path.join(tempDir, "pause-test.jsonl");
    await writeFile(
      filePath,
      [
        JSON.stringify({ symbol: "SPY", open: 100, high: 101, low: 99, close: 100.5, volume: 10, datetime: 1_000 }),
        JSON.stringify({ symbol: "SPY", open: 101, high: 102, low: 100, close: 101.5, volume: 15, datetime: 2_000 }),
      ].join("\n"),
    );

    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    streamer.pause();
    const replayPromise = streamer.replayFile({
      filePath,
      service: "HISTORICAL_CHART_EQUITY",
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockPublish).not.toHaveBeenCalled();

    streamer.resume();
    await replayPromise;

    expect(mockPublish).toHaveBeenCalledTimes(2);
  });

  test("replay throws if no prior replayFile call was made", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await expect(streamer.replay()).rejects.toThrow("No prior replay");
  });

  test("replay re-runs replayFile with the last config", async () => {
    const { HistoricalReplayStreamer } = await loadHistoricalModule();
    const streamer = new HistoricalReplayStreamer();

    await streamer.replayFile({
      filePath: path.join(FIXTURES_DIR, "synthetic-bars-1m-vendor.csv"),
      service: "HISTORICAL_CHART_EQUITY",
    });

    const firstRunCount = mockPublish.mock.calls.length;
    expect(firstRunCount).toBeGreaterThan(0);

    await streamer.replay();

    expect(mockPublish).toHaveBeenCalledTimes(firstRunCount * 2);
  });
});
