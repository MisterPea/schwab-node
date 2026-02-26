import { readFile } from "node:fs/promises";
import { ZodError } from "zod";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/scripts/request.js", () => ({
  getRequest: mockGetRequest,
}));

import {
  getOptionChain,
  getOptionExpirations,
} from "../src/derivatives/index.js";

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

    expect(Array.isArray(result)).toBe(false);
    expect(result?.symbol).toBe("AAPL");
    expect(result?.status).toBe("SUCCESS");
    expect(result?.strategy).toBe("SINGLE");
    expect(result?.assetMainType).toBe("EQUITY");
    expect(Object.keys(result?.callExpDateMap ?? {})).toContain("2026-02-20:3");
    expect(result?.putExpDateMap).toBeDefined();
  });

  test("rejects malformed option chain payload with a zod validation error", async () => {
    const payload = await fixture("option-chain.invalid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const promise = getOptionChain({ symbol: "AAPL" });
    await expect(promise).rejects.toBeInstanceOf(ZodError);
    await expect(promise).rejects.toThrow("callExpDateMap");
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
