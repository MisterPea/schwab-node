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
});
