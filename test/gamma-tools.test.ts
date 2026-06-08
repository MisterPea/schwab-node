import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GammaOptionElementSchema } from "../src/derivatives/gamma-tools/schema.js";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/request/index.js", () => ({
  getRequest: mockGetRequest,
}));

import { getGammaExposure } from "../src/derivatives/index.js";

async function fixture(name: string): Promise<string> {
  return readFile(`test/fixtures/${name}`, "utf8");
}

function jsonResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("getGammaExposure", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
  });

  async function setupHappyPath() {
    const expirations = await fixture("option-expirations.valid.json");
    const chain = await fixture("option-chain.valid.json");
    mockGetRequest
      .mockResolvedValueOnce(jsonResponse(expirations))
      .mockResolvedValueOnce(jsonResponse(chain));
    return getGammaExposure("AAPL", 0, 7);
  }

  test("returns one call and one put element", async () => {
    const result = await setupHappyPath();
    expect(result).toHaveLength(2);
    expect(result.filter((r) => r.optionType === "CALL")).toHaveLength(1);
    expect(result.filter((r) => r.optionType === "PUT")).toHaveLength(1);
  });

  test("computes signed GEX correctly for call and put", async () => {
    const result = await setupHappyPath();
    const call = result.find((r) => r.optionType === "CALL")!;
    const put = result.find((r) => r.optionType === "PUT")!;

    // CALL: gamma(0.1) * multiplier(100) * underlyingPrice(180.15) * (180.15*0.01) * openInterest(1000)
    expect(call.signedStrikeGEX).toBeCloseTo(3245402.25, 1);
    // PUT: same perContractGEX * openInterest(1200) * sign(-1)
    expect(put.signedStrikeGEX).toBeCloseTo(-3894482.7, 1);
    // perContractGEX: gamma * multiplier * price^2 * 0.01
    expect(call.perContractGEX).toBeCloseTo(3245.4, 1);
    expect(put.perContractGEX).toBeCloseTo(3245.4, 1);
  });

  test("assigns correct dteBucket and moneynessType", async () => {
    const result = await setupHappyPath();
    const call = result.find((r) => r.optionType === "CALL")!;
    const put = result.find((r) => r.optionType === "PUT")!;

    // dte=3 → 1-7DTE
    expect(call.dteBucket).toBe("1-7DTE");
    expect(put.dteBucket).toBe("1-7DTE");

    // strike=180 < underlying=180.15; call distanceFromSpot=0.15 → NTM; put distanceFromSpot=-0.15 → OTM
    expect(call.moneynessType).toBe("NTM");
    expect(put.moneynessType).toBe("OTM");
  });

  test("normalises impliedVolatility from percent to decimal", async () => {
    const result = await setupHappyPath();
    const call = result.find((r) => r.optionType === "CALL")!;
    const put = result.find((r) => r.optionType === "PUT")!;

    expect(call.impliedVolatility).toBeCloseTo(0.2);
    expect(put.impliedVolatility).toBeCloseTo(0.21);
  });

  test("populates base fields from chain data", async () => {
    const result = await setupHappyPath();
    const call = result.find((r) => r.optionType === "CALL")!;

    expect(call.underlyingSymbol).toBe("AAPL");
    expect(call.underlyingPrice).toBe(180.15);
    expect(call.strike).toBe(180);
    expect(call.expiration).toBe("2026-02-20");
    expect(call.openInterest).toBe(1000);
    expect(call.multiplier).toBe(100);
    expect(call.delta).toBe(0.5);
    expect(call.gamma).toBe(0.1);
  });

  test("each element parses cleanly against GammaOptionElementSchema", async () => {
    const result = await setupHappyPath();
    for (const element of result) {
      expect(() => GammaOptionElementSchema.parse(element)).not.toThrow();
    }
  });

  test("returns [] when no expirations fall in the requested DTE window", async () => {
    const empty = JSON.stringify({ expirationList: [] });
    mockGetRequest.mockResolvedValueOnce(jsonResponse(empty));

    const result = await getGammaExposure("AAPL", 0, 7);
    expect(result).toEqual([]);
    // only one request made — option chain should not be called
    expect(mockGetRequest).toHaveBeenCalledTimes(1);
  });

  test("returns [] when expirations are outside the requested DTE window", async () => {
    // fixture has daysToExpiration=3; requesting 10-30 excludes it
    const expirations = await fixture("option-expirations.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(expirations));

    const result = await getGammaExposure("AAPL", 10, 30);
    expect(result).toEqual([]);
    expect(mockGetRequest).toHaveBeenCalledTimes(1);
  });
});
