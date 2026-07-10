import { readFile } from "node:fs/promises";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockGetRequest } = vi.hoisted(() => ({
  mockGetRequest: vi.fn(),
}));

vi.mock("../src/request/index.js", () => ({
  getRequest: mockGetRequest,
}));

import { getAccounts } from "../src/account/accounts/index.js";

async function fixture(name: string): Promise<string> {
  return readFile(`test/fixtures/${name}`, "utf8");
}

function jsonResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("accounts contract", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
  });

  test("requests positions via fields query param", async () => {
    const payload = await fixture("accounts.positions.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    await getAccounts({ fields: "positions" });

    expect(mockGetRequest).toHaveBeenCalledTimes(1);
    const url = new URL(mockGetRequest.mock.calls[0][0] as string);
    expect(url.pathname.endsWith("/accounts")).toBe(true);
    expect(url.searchParams.get("fields")).toBe("positions");
  });

  test("omits query params when called without config", async () => {
    const payload = await fixture("accounts.positions.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    await getAccounts();

    const url = new URL(mockGetRequest.mock.calls[0][0] as string);
    expect(url.search).toBe("");
  });

  test("parses positions with equity and option instruments", async () => {
    const payload = await fixture("accounts.positions.valid.json");
    mockGetRequest.mockResolvedValueOnce(jsonResponse(payload));

    const result = await getAccounts({ fields: "positions" });

    const positions = result[0].securitiesAccount.positions;
    expect(positions).toHaveLength(2);
    expect(positions?.[0].instrument.assetType).toBe("EQUITY");
    expect(positions?.[0].instrument.symbol).toBe("AAPL");
    expect(positions?.[0].longQuantity).toBe(300);
    expect(positions?.[1].instrument.putCall).toBe("CALL");
    expect(positions?.[1].shortQuantity).toBe(1);
    expect(positions?.[1].instrument.underlyingSymbol).toBe("AAPL");
  });

  test("parses payloads without positions (backward compat)", async () => {
    const payload = JSON.parse(await fixture("accounts.positions.valid.json"));
    delete payload[0].securitiesAccount.positions;
    mockGetRequest.mockResolvedValueOnce(jsonResponse(JSON.stringify(payload)));

    const result = await getAccounts();

    expect(result[0].securitiesAccount.positions).toBeUndefined();
    expect(result[0].securitiesAccount.accountNumber).toBe("12345678");
  });
});
