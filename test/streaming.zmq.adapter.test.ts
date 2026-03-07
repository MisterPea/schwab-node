import { describe, expect, test } from "vitest";
import { adapter } from "../src/streaming/zmq/adapter.js";

describe("streaming zmq adapter", () => {
  test("remaps LEVELONE_EQUITIES numeric keys to semantic names", () => {
    const message = {
      type: "data",
      receivedAt: 1,
      payload: {
        service: "LEVELONE_EQUITIES",
        command: "SUBS",
        content: [{ key: "AAPL", "0": "AAPL", "1": 100, "34": 1700000000000 }],
      },
    };

    const result = adapter(message) as typeof message;
    expect(result).not.toBe(message);
    expect(result.payload.content).toEqual([
      {
        key: "AAPL",
        symbol: "AAPL",
        bidPrice: 100,
        quoteTime: 1700000000000,
      },
    ]);
    expect(message.payload.content).toEqual([
      { key: "AAPL", "0": "AAPL", "1": 100, "34": 1700000000000 },
    ]);
  });

  test("remaps BOOK nested price levels and market makers", () => {
    const message = {
      type: "data",
      receivedAt: 1,
      payload: {
        service: "NYSE_BOOK",
        command: "SUBS",
        content: [
          {
            key: "AAPL",
            "0": "AAPL",
            "2": [
              {
                "0": 200.1,
                "1": 10,
                "2": 1,
                "3": [{ "0": "NSDQ", "1": 10, "2": 1700000000123 }],
              },
            ],
          },
        ],
      },
    };

    const result = adapter(message) as typeof message;

    expect(result.payload.content).toEqual([
      {
        key: "AAPL",
        symbol: "AAPL",
        bidSideLevels: [
          {
            price: 200.1,
            aggregateSize: 10,
            marketMakerCount: 1,
            marketMakers: [
              {
                marketMakerId: "NSDQ",
                size: 10,
                quoteTime: 1700000000123,
              },
            ],
          },
        ],
      },
    ]);
  });

  test("passes through non-data and unknown services", () => {
    const notify = {
      type: "notify",
      receivedAt: 1,
      payload: { heartbeat: "123" },
    };
    expect(adapter(notify)).toBe(notify);

    const unknownService = {
      type: "data",
      receivedAt: 1,
      payload: {
        service: "UNKNOWN_SERVICE",
        content: [{ "1": 100 }],
      },
    };
    expect(adapter(unknownService)).toEqual(unknownService);
  });

  test("preserves unknown numeric keys in supported services", () => {
    const message = {
      type: "data",
      receivedAt: 1,
      payload: {
        service: "CHART_EQUITY",
        content: [{ "0": "AAPL", "1": 200, "999": "extra" }],
      },
    };

    const result = adapter(message) as typeof message;
    expect(result.payload.content).toEqual([
      { symbol: "AAPL", openPrice: 200, "999": "extra" },
    ]);
  });
});
