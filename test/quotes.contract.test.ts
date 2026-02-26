import { readFile } from "node:fs/promises";
import { ZodError } from "zod";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/scripts/request.js", () => ({
  getRequest: mockGetRequest,
}));

import { getQuote } from "../src/market-data/get-quote/index.js";

async function fixture(name: string): Promise<string> {
  return readFile(`test/fixtures/${name}`, "utf8");
}

function jsonResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("quotes contract", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
  });

  test("accepts valid Schwab-like quote payload", async () => {
    const payload = await fixture("quotes.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const result = await getQuote({ symbols: "AAPL", fields: "quote" });

    expect(Array.isArray(result)).toBe(false);
    expect(Object.keys(result)).toEqual(["AAPL"]);
    expect(result.AAPL).toBeDefined();
    expect(result.AAPL.symbol).toBe("AAPL");
    expect(result.AAPL.quote?.bidPrice).toBe(180.12);
  });

  test("allows extra top-level fields in quote envelopes", async () => {
    mockGetRequest.mockResolvedValueOnce(
      jsonResponse(
        JSON.stringify({
          AAPL: {
            assetMainType: "EQUITY",
            assetSubType: "COE",
            ssid: 101,
            symbol: "AAPL",
            vendorTag: "fixture-extra",
            quote: {
              closePrice: 179.5,
              lastPrice: 180.15,
              netChange: 0.65,
              securityStatus: "Normal",
              tradeTime: 1760985600000,
              bidPrice: 180.12,
              askPrice: 180.18,
            },
          },
        }),
      ),
    );

    const result = await getQuote({ symbols: "AAPL", fields: "quote" });
    expect((result.AAPL as Record<string, unknown>).vendorTag).toBe("fixture-extra");
  });

  test("rejects malformed quote payload with a zod validation error", async () => {
    const payload = await fixture("quotes.invalid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const promise = getQuote({ symbols: "AAPL", fields: "quote" });
    await expect(promise).rejects.toBeInstanceOf(ZodError);
    await expect(promise).rejects.toThrow("closePrice");
  });
});
