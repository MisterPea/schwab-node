import { existsSync } from "node:fs";
import process from "node:process";
import { describe, expect, test } from "vitest";
import { getQuote } from "../src/marketData/quotes.js";

const hasTokenFile = existsSync(".secrets/token");
const runLive = process.env.RUN_LIVE_TESTS === "1" && hasTokenFile;

const liveDescribe = runLive ? describe : describe.skip;

liveDescribe("quotes live smoke", () => {
  test(
    "fetches live quote for AAPL",
    { timeout: 20_000 },
    async () => {
      const result = await getQuote({ symbols: "AAPL", fields: "quote" });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].AAPL.symbol).toBe("AAPL");
      expect(typeof result[0].AAPL.quote?.bidPrice).toBe("number");
      expect(typeof result[0].AAPL.quote?.askPrice).toBe("number");
    },
  );
});
