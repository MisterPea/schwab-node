import { existsSync } from "node:fs";
import process from "node:process";
import { describe, expect, test } from "vitest";
import { getQuote } from "../src/market-data/get-quote/index.js";

const hasTokenFile = existsSync(".secrets/token");
const runLive = process.env.RUN_LIVE_TESTS === "1" && hasTokenFile;

const liveDescribe = runLive ? describe : describe.skip;

liveDescribe("quotes live smoke", () => {
  test(
    "fetches live quote for AAPL",
    { timeout: 20_000 },
    async () => {
      const result = await getQuote({ symbols: "AAPL", fields: "quote" });
      expect(Object.keys(result).length).toBeGreaterThan(0);
      expect(result.AAPL.symbol).toBe("AAPL");
      expect(typeof result.AAPL.quote?.bidPrice).toBe("number");
      expect(typeof result.AAPL.quote?.askPrice).toBe("number");
    },
  );
});
