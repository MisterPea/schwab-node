import { afterEach, describe, expect, test, vi } from "vitest";
import { createGetRequest } from "../src/marketData/request.js";

describe("createGetRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("adds authorization and accept headers to GET request", async () => {
    const authProvider = {
      getAuth: vi.fn().mockResolvedValue({
        access_token: "abc123",
        token_type: "Bearer",
      }),
    };

    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const getRequest = createGetRequest(authProvider);
    await getRequest("https://example.test/resource");

    expect(authProvider.getAuth).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(options.method).toBe("GET");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer abc123");
  });

  test("throws on non-2xx responses with status and body text", async () => {
    const authProvider = {
      getAuth: vi.fn().mockResolvedValue({
        access_token: "abc123",
        token_type: "Bearer",
      }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not allowed", { status: 403 })),
    );

    const getRequest = createGetRequest(authProvider);
    await expect(getRequest("https://example.test/forbidden")).rejects.toThrow(
      "HTTP 403: not allowed",
    );
  });
});
