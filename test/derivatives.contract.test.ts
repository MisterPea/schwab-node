import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/marketData/request.js", () => ({
  getRequest: mockGetRequest,
}));

import { getOptionChain, getOptionExpirations } from "../src/marketData/derivatives.js";

async function fixture(name: string): Promise<string> {
  return readFile(`test/fixtures/${name}`, "utf8");
}

function jsonResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("derivatives contract", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
  });

  test("accepts valid Schwab-like option chain payload", async () => {
    const payload = await fixture("option-chain.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const result = await getOptionChain({ symbol: "AAPL", strikeCount: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("AAPL");
    expect(Object.keys(result[0].callExpDateMap)).toContain("2026-02-20:3");
  });

  test("rejects malformed option chain payload", async () => {
    const payload = await fixture("option-chain.invalid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    await expect(getOptionChain({ symbol: "AAPL" })).rejects.toThrow(
      "No options chain data returned for symbol: AAPL",
    );
  });

  test("accepts valid Schwab-like option expiration payload", async () => {
    const payload = await fixture("option-expirations.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const result = await getOptionExpirations({ symbol: "AAPL" });

    expect(result).toHaveLength(1);
    expect(result[0].daysToExpiration).toBe(3);
    expect(result[0].expirationDate).toBe("2026-02-20");
  });
});
