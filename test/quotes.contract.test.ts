import { readFile } from "node:fs/promises";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/marketData/request.js", () => ({
  getRequest: mockGetRequest,
}));

import { getQuote } from "../src/marketData/quotes.js";

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

    expect(result).toHaveLength(1);
    expect(result[0].AAPL.symbol).toBe("AAPL");
    expect(result[0].AAPL.quote?.bidPrice).toBe(180.12);
  });

  test("rejects malformed quote payload", async () => {
    const payload = await fixture("quotes.invalid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    await expect(getQuote({ symbols: "AAPL", fields: "quote" })).rejects.toThrow(
      "No quote data returned for symbols: AAPL",
    );
  });
});
