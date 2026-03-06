import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/request/index.js", () => ({
  createGetRequest: vi.fn(),
  getRequest: mockGetRequest,
}));

async function fixture(name: string): Promise<string> {
  return readFile(`test/fixtures/${name}`, "utf8");
}

function jsonResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("legacy package bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetRequest.mockReset();
    vi.resetModules();
  });

  test("wraps legacy quote responses and warns about the new route", async () => {
    const payload = await fixture("quotes.valid.json");
    const emitWarning = vi
      .spyOn(process, "emitWarning")
      .mockImplementation(() => {});
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const legacyQuotes = await import("../src/marketData/quotes.js");
    const result = await legacyQuotes.getQuote({
      symbols: "AAPL",
      fields: "quote",
    });

    expect(result).toHaveLength(1);
    expect(result[0].AAPL.symbol).toBe("AAPL");
    expect(emitWarning).toHaveBeenCalledTimes(1);
    expect(`${emitWarning.mock.calls[0][0]}`).toContain(
      "@misterpea/schwab-node/marketData/quotes",
    );
    expect(`${emitWarning.mock.calls[0][0]}`).toContain(
      "@misterpea/schwab-node/market-data",
    );
  });

  test("preserves the legacy movers response envelope", async () => {
    const emitWarning = vi
      .spyOn(process, "emitWarning")
      .mockImplementation(() => {});
    mockGetRequest.mockResolvedValueOnce(
      jsonResponse(
        JSON.stringify({
          screeners: [
            {
              symbol: "AAPL",
              description: "Apple Inc.",
              volume: 100,
              lastPrice: 180.12,
              netChange: 1.25,
              marketShare: 12.3,
              totalVolume: 200,
              trades: 50,
              netPercentChange: 0.7,
            },
          ],
        }),
      ),
    );

    const legacyHighLevelData = await import(
      "../src/marketData/highLevelData.js"
    );
    const result = await legacyHighLevelData.getMovers({
      index: "$SPX",
      sort: "VOLUME",
    });

    expect(result).toEqual([
      {
        screeners: [
          expect.objectContaining({
            symbol: "AAPL",
            description: "Apple Inc.",
          }),
        ],
      },
    ]);
    expect(emitWarning).toHaveBeenCalledTimes(1);
  });

  test("maps ATM option output back to the legacy day_of_week field", async () => {
    const emitWarning = vi
      .spyOn(process, "emitWarning")
      .mockImplementation(() => {});
    vi.doMock("../src/derivatives/get-atm-option-data/index.js", () => ({
      getAtmOptionData: vi.fn().mockResolvedValue([
        {
          put_call: "CALL",
          day_of_expiry: "FRI",
          underlying: "AAPL",
          open_interest: 1000,
          total_volume: 100,
          symbol: "AAPL  260220C00180000",
          dte: 3,
          theta: -0.02,
          strike_price: 180,
          gamma: 0.1,
          volatility: 20,
          vega: 0.05,
          delta: 0.5,
          rho: 0.01,
        },
      ]),
    }));

    const legacyDerivatives = await import("../src/marketData/derivatives.js");
    const result = await legacyDerivatives.getAtmOptionData({
      symbol: "AAPL",
      window: [1, 5],
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("day_of_week");
    expect(result[0]).not.toHaveProperty("day_of_expiry");
    expect(result[0]).not.toHaveProperty("rho");
    expect(emitWarning).toHaveBeenCalledTimes(1);
  });
});
