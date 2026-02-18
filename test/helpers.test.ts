import { afterEach, describe, expect, test, vi } from "vitest";
import {
  addDays,
  constructMarketDataUrl,
  convertIsoStringToMs,
  readableStreamToObject,
} from "../src/helpers.js";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("helpers", () => {
  test("convertIsoStringToMs returns epoch milliseconds", () => {
    const ms = convertIsoStringToMs("2026-02-17");
    expect(ms).toBe(new Date("2026-02-17").getTime());
  });

  test("addDays returns a YYYY-MM-DD date string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00Z"));
    expect(addDays(3)).toBe("2026-02-20");
  });

  test("constructMarketDataUrl encodes endpoint and params", () => {
    const url = constructMarketDataUrl(
      { symbol: "AAPL", periodType: "day", period: 5 },
      "/pricehistory",
    );
    expect(url).toContain("/marketdata/v1/pricehistory");
    expect(url).toContain("symbol=AAPL");
    expect(url).toContain("periodType=day");
    expect(url).toContain("period=5");
  });

  test("readableStreamToObject parses multiple JSON objects split across chunks", async () => {
    const stream = streamFromChunks(['{"a":1}', '{"b"', ':2}']);
    const objects = await readableStreamToObject<{ a?: number; b?: number }>(stream);
    expect(objects).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("readableStreamToObject applies validator when provided", async () => {
    const stream = streamFromChunks(['{"ok":true}', '{"ok":false}']);
    const objects = await readableStreamToObject<{ ok: boolean }>(
      stream,
      (value): value is { ok: boolean } =>
        typeof value === "object" &&
        value !== null &&
        "ok" in value &&
        (value as { ok: boolean }).ok === true,
    );
    expect(objects).toEqual([{ ok: true }]);
  });
});
