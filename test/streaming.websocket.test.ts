import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  MockWebSocket,
  mockCreatePublisher,
  mockGetAuth,
  mockGetDefaultAuth,
  mockGetUserPreference,
  mockPublish,
} = vi.hoisted(() => {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: MockWebSocket[] = [];

    readonly url: string;
    readyState = MockWebSocket.CONNECTING;
    sent: string[] = [];
    private readonly listeners = new Map<
      string,
      Set<(...args: unknown[]) => void>
    >();

    constructor(url: string) {
      this.url = url;
      MockWebSocket.instances.push(this);
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    once(event: string, listener: (...args: unknown[]) => void): this {
      const onceListener = (...args: unknown[]) => {
        this.off(event, onceListener);
        listener(...args);
      };

      return this.on(event, onceListener);
    }

    off(event: string, listener: (...args: unknown[]) => void): this {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }

    send(data: string): void {
      if (this.readyState !== MockWebSocket.OPEN) {
        throw new Error("Socket is not open");
      }

      this.sent.push(data);
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close");
    }

    emitOpen(): void {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open");
    }

    emitFrame(payload: unknown): void {
      const raw =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      this.emit("message", raw, false);
    }

    emitSocketError(error = new Error("socket error")): void {
      this.emit("error", error);
    }
  }

  return {
    MockWebSocket,
    mockGetUserPreference: vi.fn(),
    mockGetAuth: vi.fn(),
    mockGetDefaultAuth: vi.fn(),
    mockCreatePublisher: vi.fn(),
    mockPublish: vi.fn(),
  };
});

vi.mock("ws", () => ({
  WebSocket: MockWebSocket,
}));

vi.mock("../src/account/index.js", () => ({
  getUserPreference: mockGetUserPreference,
}));

vi.mock("../src/oauth/defaultAuth.js", () => ({
  getDefaultAuth: mockGetDefaultAuth,
}));

vi.mock("../src/streaming/zmq/publisher.js", () => ({
  createPublisher: mockCreatePublisher,
  publish: mockPublish,
}));

function defaultUserPreference() {
  return {
    accounts: [],
    offers: [],
    streamerInfo: [
      {
        streamerSocketUrl: "wss://streamer.test/ws",
        schwabClientCustomerId: "customer-1",
        schwabClientCorrelId: "correl-1",
        schwabClientChannel: "N9",
        schwabClientFunctionId: "APIAPP",
      },
    ],
  };
}

function parseLastRequest(ws: InstanceType<typeof MockWebSocket>) {
  return JSON.parse(ws.sent.at(-1) ?? "{}") as {
    requests: Array<{
      command: string;
      requestid: string;
      parameters?: Record<string, string>;
    }>;
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function loadStreamerModule() {
  return import("../src/streaming/websocket/index.js");
}

async function loadFieldsModule() {
  return import("../src/streaming/websocket/fields.js");
}

async function createConnectedStreamer() {
  const module = await loadStreamerModule();
  const streamer = new module.SchwabStreamer();
  const connectPromise = streamer.connect();
  await flushMicrotasks();
  const ws = MockWebSocket.instances[0];
  ws.emitOpen();
  await connectPromise;
  return { module, streamer, ws };
}

async function loginStreamer(
  streamer: Awaited<ReturnType<typeof createConnectedStreamer>>["streamer"],
  ws: InstanceType<typeof MockWebSocket>,
): Promise<void> {
  const loginPromise = streamer.login();
  await flushMicrotasks();
  const loginRequest = parseLastRequest(ws).requests[0];

  ws.emitFrame({
    response: [
      {
        service: "ADMIN",
        command: "LOGIN",
        requestid: loginRequest.requestid,
        SchwabClientCorrelId: "correl-1",
        timestamp: 1,
        content: {
          code: 0,
          msg: "server=test;status=PN",
        },
      },
    ],
  });

  await loginPromise;
}

beforeEach(() => {
  MockWebSocket.instances = [];
  mockGetUserPreference.mockReset();
  mockGetAuth.mockReset();
  mockGetDefaultAuth.mockReset();
  mockCreatePublisher.mockReset();
  mockPublish.mockReset();

  mockGetUserPreference.mockResolvedValue(defaultUserPreference());
  mockGetAuth.mockResolvedValue({
    access_token: "token-123",
    token_type: "Bearer",
  });
  mockGetDefaultAuth.mockReturnValue({
    getAuth: mockGetAuth,
  });
  mockCreatePublisher.mockResolvedValue({
    linger: -1,
    close: vi.fn().mockResolvedValue(undefined),
  });
  mockPublish.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("SchwabStreamer", () => {
  test("exports stable semantic field maps", async () => {
    const {
      ACCT_ACTIVITY_FIELDS,
      ACCT_ACTIVITY_FIELD_IDS_BY_NAME,
      BOOK_FIELDS,
      BOOK_FIELD_IDS_BY_NAME,
      BOOK_MARKET_MAKER_FIELDS,
      BOOK_PRICE_LEVEL_FIELDS,
      CHART_EQUITY_FIELDS,
      CHART_EQUITY_FIELD_IDS_BY_NAME,
      CHART_FUTURES_FIELDS,
      CHART_FUTURES_FIELD_IDS_BY_NAME,
      LEVELONE_EQUITIES_FIELDS,
      LEVELONE_EQUITIES_FIELD_IDS_BY_NAME,
      LEVELONE_FOREX_FIELDS,
      LEVELONE_FOREX_FIELD_IDS_BY_NAME,
      LEVELONE_OPTIONS_FIELDS,
      LEVELONE_OPTIONS_FIELD_IDS_BY_NAME,
      LEVELONE_FUTURES_FIELDS,
      LEVELONE_FUTURES_FIELD_IDS_BY_NAME,
      LEVELONE_FUTURES_OPTIONS_FIELDS,
      LEVELONE_FUTURES_OPTIONS_FIELD_IDS_BY_NAME,
      SCREENER_FIELDS,
      SCREENER_FIELD_IDS_BY_NAME,
      resolveAcctActivityFieldIds,
      resolveAcctActivityFieldNames,
      resolveBookFieldIds,
      resolveBookFieldNames,
      resolveBookMarketMakerFieldIds,
      resolveBookPriceLevelFieldIds,
      resolveChartEquityFieldIds,
      resolveChartEquityFieldNames,
      resolveChartFuturesFieldIds,
      resolveChartFuturesFieldNames,
      resolveLevelOneEquitiesFieldIds,
      resolveLevelOneEquitiesFieldNames,
      resolveLevelOneForexFieldIds,
      resolveLevelOneForexFieldNames,
      resolveLevelOneFuturesFieldIds,
      resolveLevelOneFuturesFieldNames,
      resolveLevelOneFuturesOptionsFieldIds,
      resolveLevelOneFuturesOptionsFieldNames,
      resolveScreenerFieldIds,
      resolveScreenerFieldNames,
      resolveLevelOneOptionsFieldIds,
      resolveLevelOneOptionsFieldNames,
    } = await loadFieldsModule();

    expect(CHART_EQUITY_FIELDS["0"]).toBe("symbol");
    expect(CHART_EQUITY_FIELDS["7"]).toBe("chartTime");
    expect(CHART_EQUITY_FIELD_IDS_BY_NAME.chartTime).toBe("7");
    expect(
      resolveChartEquityFieldNames([
        "symbol",
        "openPrice",
        "chartTime",
        "openPrice",
      ]),
    ).toEqual(["0", "1", "7"]);
    expect(resolveChartEquityFieldIds(["0", "1", "7"])).toEqual([
      "symbol",
      "openPrice",
      "chartTime",
    ]);

    expect(CHART_FUTURES_FIELDS["0"]).toBe("symbol");
    expect(CHART_FUTURES_FIELDS["1"]).toBe("chartTime");
    expect(CHART_FUTURES_FIELD_IDS_BY_NAME.chartTime).toBe("1");
    expect(
      resolveChartFuturesFieldNames([
        "symbol",
        "chartTime",
        "openPrice",
        "chartTime",
      ]),
    ).toEqual(["0", "1", "2"]);
    expect(resolveChartFuturesFieldIds(["0", "1", "2"])).toEqual([
      "symbol",
      "chartTime",
      "openPrice",
    ]);

    expect(SCREENER_FIELDS["0"]).toBe("symbol");
    expect(SCREENER_FIELDS["4"]).toBe("items");
    expect(SCREENER_FIELD_IDS_BY_NAME.items).toBe("4");
    expect(
      resolveScreenerFieldNames(["symbol", "timestamp", "items", "timestamp"]),
    ).toEqual(["0", "1", "4"]);
    expect(resolveScreenerFieldIds(["0", "1", "4"])).toEqual([
      "symbol",
      "timestamp",
      "items",
    ]);

    expect(ACCT_ACTIVITY_FIELDS["0"]).toBe("subscriptionKey");
    expect(ACCT_ACTIVITY_FIELD_IDS_BY_NAME.subscriptionKey).toBe("0");
    expect(resolveAcctActivityFieldNames([" subscriptionKey ", "subscriptionKey"])).toEqual([
      "0",
    ]);
    expect(resolveAcctActivityFieldIds(["0"])).toEqual(["subscriptionKey"]);

    expect(BOOK_FIELDS["0"]).toBe("symbol");
    expect(BOOK_FIELDS["1"]).toBe("marketSnapshotTime");
    expect(BOOK_FIELDS["2"]).toBe("bidSideLevels");
    expect(BOOK_FIELD_IDS_BY_NAME.symbol).toBe("0");
    expect(BOOK_FIELD_IDS_BY_NAME.bidSideLevels).toBe("2");
    expect(
      resolveBookFieldNames([
        " symbol ",
        "marketSnapshotTime",
        "bidSideLevels",
        "marketSnapshotTime",
      ]),
    ).toEqual(["0", "1", "2"]);
    expect(resolveBookFieldIds(["0", " 1 ", "2"])).toEqual([
      "symbol",
      "marketSnapshotTime",
      "bidSideLevels",
    ]);
    expect(resolveBookPriceLevelFieldIds(["0", "1", "2", "3"])).toEqual([
      "price",
      "aggregateSize",
      "marketMakerCount",
      "marketMakers",
    ]);
    expect(resolveBookMarketMakerFieldIds(["0", "1", "2"])).toEqual([
      "marketMakerId",
      "size",
      "quoteTime",
    ]);
    expect(BOOK_PRICE_LEVEL_FIELDS["3"]).toBe("marketMakers");
    expect(BOOK_MARKET_MAKER_FIELDS["2"]).toBe("quoteTime");

    expect(LEVELONE_EQUITIES_FIELDS["0"]).toBe("symbol");
    expect(LEVELONE_EQUITIES_FIELDS["34"]).toBe("quoteTime");
    expect(LEVELONE_EQUITIES_FIELD_IDS_BY_NAME.symbol).toBe("0");
    expect(LEVELONE_EQUITIES_FIELD_IDS_BY_NAME.quoteTime).toBe("34");
    expect(
      resolveLevelOneEquitiesFieldNames([
        " symbol ",
        "bidPrice",
        "quoteTime",
        "bidPrice",
      ]),
    ).toEqual(["0", "1", "34"]);
    expect(resolveLevelOneEquitiesFieldIds(["0", " 1 ", "34"])).toEqual([
      "symbol",
      "bidPrice",
      "quoteTime",
    ]);

    expect(LEVELONE_OPTIONS_FIELDS["0"]).toBe("symbol");
    expect(LEVELONE_OPTIONS_FIELDS["38"]).toBe("quoteTime");
    expect(LEVELONE_OPTIONS_FIELD_IDS_BY_NAME.symbol).toBe("0");
    expect(LEVELONE_OPTIONS_FIELD_IDS_BY_NAME.quoteTime).toBe("38");
    expect(
      resolveLevelOneOptionsFieldNames([
        " symbol ",
        "bidPrice",
        "quoteTime",
        "bidPrice",
      ]),
    ).toEqual(["0", "2", "38"]);
    expect(resolveLevelOneOptionsFieldIds(["0", " 2 ", "38"])).toEqual([
      "symbol",
      "bidPrice",
      "quoteTime",
    ]);

    expect(LEVELONE_FUTURES_OPTIONS_FIELDS["0"]).toBe("symbol");
    expect(LEVELONE_FUTURES_OPTIONS_FIELDS["10"]).toBe("quoteTime");
    expect(LEVELONE_FUTURES_OPTIONS_FIELD_IDS_BY_NAME.symbol).toBe("0");
    expect(LEVELONE_FUTURES_OPTIONS_FIELD_IDS_BY_NAME.quoteTime).toBe("10");
    expect(
      resolveLevelOneFuturesOptionsFieldNames([
        " symbol ",
        "bidPrice",
        "quoteTime",
        "bidPrice",
      ]),
    ).toEqual(["0", "1", "10"]);
    expect(
      resolveLevelOneFuturesOptionsFieldIds(["0", " 1 ", "10"]),
    ).toEqual(["symbol", "bidPrice", "quoteTime"]);

    expect(LEVELONE_FOREX_FIELDS["0"]).toBe("symbol");
    expect(LEVELONE_FOREX_FIELDS["8"]).toBe("quoteTime");
    expect(LEVELONE_FOREX_FIELD_IDS_BY_NAME.symbol).toBe("0");
    expect(LEVELONE_FOREX_FIELD_IDS_BY_NAME.quoteTime).toBe("8");
    expect(
      resolveLevelOneForexFieldNames([
        " symbol ",
        "bidPrice",
        "quoteTime",
        "bidPrice",
      ]),
    ).toEqual(["0", "1", "8"]);
    expect(resolveLevelOneForexFieldIds(["0", " 1 ", "8"])).toEqual([
      "symbol",
      "bidPrice",
      "quoteTime",
    ]);

    expect(LEVELONE_FUTURES_FIELDS["0"]).toBe("symbol");
    expect(LEVELONE_FUTURES_FIELDS["10"]).toBe("quoteTime");
    expect(LEVELONE_FUTURES_FIELD_IDS_BY_NAME.symbol).toBe("0");
    expect(LEVELONE_FUTURES_FIELD_IDS_BY_NAME.quoteTime).toBe("10");
    expect(
      resolveLevelOneFuturesFieldNames([
        " symbol ",
        "bidPrice",
        "bidPrice",
        "quoteTime",
      ]),
    ).toEqual(["0", "1", "10"]);
    expect(resolveLevelOneFuturesFieldIds(["0", " 1 ", "1", "10"])).toEqual([
      "symbol",
      "bidPrice",
      "quoteTime",
    ]);
  });

  test("rejects unknown semantic fields", async () => {
    const {
      resolveAcctActivityFieldNames,
      resolveBookFieldNames,
      resolveChartEquityFieldNames,
      resolveChartFuturesFieldNames,
      resolveLevelOneEquitiesFieldNames,
      resolveLevelOneForexFieldNames,
      resolveLevelOneFuturesFieldNames,
      resolveLevelOneFuturesOptionsFieldNames,
      resolveLevelOneOptionsFieldNames,
      resolveScreenerFieldNames,
    } = await loadFieldsModule();

    expect(() => resolveLevelOneEquitiesFieldNames(["symbol", "nope"])).toThrow(
      "Unknown LEVELONE_EQUITIES field: nope",
    );
    expect(() => resolveBookFieldNames(["symbol", "nope"])).toThrow(
      "Unknown NYSE_BOOK field: nope",
    );
    expect(() => resolveChartEquityFieldNames(["symbol", "nope"])).toThrow(
      "Unknown CHART_EQUITY field: nope",
    );
    expect(() => resolveChartFuturesFieldNames(["symbol", "nope"])).toThrow(
      "Unknown CHART_FUTURES field: nope",
    );
    expect(() => resolveLevelOneOptionsFieldNames(["symbol", "nope"])).toThrow(
      "Unknown LEVELONE_OPTIONS field: nope",
    );
    expect(() => resolveScreenerFieldNames(["symbol", "nope"])).toThrow(
      "Unknown SCREENER_EQUITY field: nope",
    );
    expect(
      () => resolveLevelOneFuturesOptionsFieldNames(["symbol", "nope"]),
    ).toThrow("Unknown LEVELONE_FUTURES_OPTIONS field: nope");
    expect(() => resolveLevelOneForexFieldNames(["symbol", "nope"])).toThrow(
      "Unknown LEVELONE_FOREX field: nope",
    );
    expect(() => resolveAcctActivityFieldNames(["subscriptionKey", "nope"])).toThrow(
      "Unknown ACCT_ACTIVITY field: nope",
    );

    expect(() => resolveLevelOneFuturesFieldNames(["symbol", "nope"])).toThrow(
      "Unknown LEVELONE_FUTURES field: nope",
    );
  });

  test("buildLoginRequest wraps the Schwab login payload in requests[]", async () => {
    const { __streamerInternals } = await loadStreamerModule();

    const request = __streamerInternals.buildLoginRequest(
      {
        streamerSocketUrl: "wss://streamer.test/ws",
        schwabClientCustomerId: "customer-1",
        schwabClientCorrelId: "correl-1",
        schwabClientChannel: "N9",
        schwabClientFunctionId: "APIAPP",
        accessToken: "token-123",
      },
      "1",
    );

    expect(request).toEqual({
      requests: [
        {
          service: "ADMIN",
          command: "LOGIN",
          requestid: "1",
          SchwabClientCustomerId: "customer-1",
          SchwabClientCorrelId: "correl-1",
          parameters: {
            Authorization: "token-123",
            SchwabClientChannel: "N9",
            SchwabClientFunctionId: "APIAPP",
          },
        },
      ],
    });
  });

  test("connect waits for websocket open and does not send login automatically", async () => {
    const { SchwabStreamer } = await loadStreamerModule();
    const streamer = new SchwabStreamer();

    const connectPromise = streamer.connect();
    await flushMicrotasks();
    const ws = MockWebSocket.instances[0];

    expect(ws.sent).toHaveLength(0);

    ws.emitOpen();
    await connectPromise;

    expect(streamer.connected).toBe(true);
    expect(streamer.loggedIn).toBe(false);
    expect(ws.sent).toHaveLength(0);
    expect(mockCreatePublisher).toHaveBeenCalledWith("tcp://*:5555");
  });

  test("login sends ADMIN/LOGIN and waits for the matching response id", async () => {
    const { streamer, ws } = await createConnectedStreamer();

    let resolved = false;
    const loginPromise = streamer.login().then(() => {
      resolved = true;
    });
    await flushMicrotasks();

    const loginRequest = parseLastRequest(ws).requests[0];
    expect(loginRequest.command).toBe("LOGIN");

    ws.emitFrame({
      response: [
        {
          service: "ADMIN",
          command: "LOGIN",
          requestid: "999",
          SchwabClientCorrelId: "correl-1",
          timestamp: 1,
          content: {
            code: 0,
            msg: "server=test;status=PN",
          },
        },
      ],
    });

    await flushMicrotasks();
    expect(resolved).toBe(false);

    ws.emitFrame({
      response: [
        {
          service: "ADMIN",
          command: "LOGIN",
          requestid: loginRequest.requestid,
          SchwabClientCorrelId: "correl-1",
          timestamp: 2,
          content: {
            code: 0,
            msg: "server=test;status=PN",
          },
        },
      ],
    });

    await loginPromise;

    expect(streamer.loggedIn).toBe(true);
    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      "schwab.response.ADMIN",
      expect.objectContaining({
        type: "response",
        payload: expect.objectContaining({
          command: "LOGIN",
          requestid: loginRequest.requestid,
        }),
      }),
    );
  });

  test("subs rejects before login", async () => {
    const { streamer } = await createConnectedStreamer();

    await expect(
      streamer.subs({
        service: "LEVELONE_EQUITIES",
        keys: ["AAPL"],
        fields: ["0", "1"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );
  });

  test("subsL1Futures rejects before login", async () => {
    const { streamer } = await createConnectedStreamer();

    await expect(
      streamer.subsL1Futures({
        keys: ["/ESH26"],
        fields: ["symbol", "bidPrice"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );
  });

  test("equities and options semantic helpers reject before login", async () => {
    const { streamer } = await createConnectedStreamer();

    await expect(
      streamer.subsL1Equities({
        keys: ["AAPL"],
        fields: ["symbol", "bidPrice"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsL1Options({
        keys: ["AAPL  251219C00200000"],
        fields: ["symbol", "bidPrice"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsL1FuturesOptions({
        keys: ["./OZCZ23C565"],
        fields: ["symbol", "bidPrice"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsL1Forex({
        keys: ["EUR/USD"],
        fields: ["symbol", "bidPrice"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsL2NyseBook({
        keys: ["AAPL"],
        fields: ["symbol", "bidSideLevels"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsL2NasdaqBook({
        keys: ["MSFT"],
        fields: ["symbol", "askSideLevels"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsL2OptionsBook({
        keys: ["AAPL  251219C00200000"],
        fields: ["symbol", "marketSnapshotTime"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsChartEquity({
        keys: ["AAPL"],
        fields: ["symbol", "chartTime"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsChartFutures({
        keys: ["/ESH26"],
        fields: ["symbol", "chartTime"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsScreenerEquity({
        keys: ["NYSE_VOLUME_0"],
        fields: ["symbol", "items"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsScreenerOption({
        keys: ["OPTION_CALL_VOLUME_0"],
        fields: ["symbol", "items"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );

    await expect(
      streamer.subsAcctActivity({
        keys: ["CLIENT_KEY"],
        fields: ["subscriptionKey"],
      }),
    ).rejects.toThrow(
      "Streamer must be logged in before sending service commands",
    );
  });

  test("service commands run serially instead of overlapping", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subs({
      service: "LEVELONE_EQUITIES",
      keys: ["AAPL"],
      fields: ["0", "1", "2"],
    });

    const addPromise = streamer.add({
      service: "LEVELONE_EQUITIES",
      keys: ["MSFT"],
      fields: ["0", "1", "2"],
    });
    await flushMicrotasks();

    expect(parseLastRequest(ws).requests[0].command).toBe("SUBS");
    expect(ws.sent).toHaveLength(2);

    const subsRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });

    await flushMicrotasks();

    expect(ws.sent).toHaveLength(3);
    expect(parseLastRequest(ws).requests[0].command).toBe("ADD");

    const addRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });

    await Promise.all([subsPromise, addPromise]);
  });

  test("non-success response codes reject the waiting command", async () => {
    const { streamer, ws } = await createConnectedStreamer();

    const loginPromise = streamer.login();
    await flushMicrotasks();
    const loginRequest = parseLastRequest(ws).requests[0];

    ws.emitFrame({
      response: [
        {
          service: "ADMIN",
          command: "LOGIN",
          requestid: loginRequest.requestid,
          timestamp: 1,
          content: {
            code: 3,
            msg: "Login Denied.: token is invalid or has expired.",
          },
        },
      ],
    });

    await expect(loginPromise).rejects.toThrow(
      "Streamer command LOGIN failed (3)",
    );
    expect(streamer.loggedIn).toBe(false);
  });

  test("publishes notify and data frames to stable ZMQ topics", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    ws.emitFrame({
      notify: [
        {
          heartbeat: "12345",
        },
      ],
      data: [
        {
          service: "LEVELONE_EQUITIES",
          command: "SUBS",
          timestamp: 10,
          content: [{ key: "AAPL", "1": 100 }],
        },
      ],
    });

    await flushMicrotasks();

    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      "schwab.notify",
      expect.objectContaining({
        type: "notify",
        payload: {
          heartbeat: "12345",
        },
      }),
    );

    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      "schwab.data.LEVELONE_EQUITIES",
      expect.objectContaining({
        type: "data",
        payload: expect.objectContaining({
          service: "LEVELONE_EQUITIES",
          content: [
            {
              key: "AAPL",
              bidPrice: 100,
            },
          ],
        }),
      }),
    );
    expect(streamer.getSubscriptionState()).toEqual({});
  });

  test("publishes BOOK data with nested semantic field names", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    ws.emitFrame({
      data: [
        {
          service: "NYSE_BOOK",
          command: "SUBS",
          timestamp: 10,
          content: [
            {
              key: "AAPL",
              "0": "AAPL",
              "2": [
                {
                  "0": 200.1,
                  "1": 10,
                  "2": 1,
                  "3": [{ "0": "NSDQ", "1": 10, "2": 1700000000123 }],
                },
              ],
            },
          ],
        },
      ],
    });

    await flushMicrotasks();

    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      "schwab.data.NYSE_BOOK",
      expect.objectContaining({
        type: "data",
        payload: expect.objectContaining({
          service: "NYSE_BOOK",
          content: [
            {
              key: "AAPL",
              symbol: "AAPL",
              bidSideLevels: [
                {
                  price: 200.1,
                  aggregateSize: 10,
                  marketMakerCount: 1,
                  marketMakers: [
                    {
                      marketMakerId: "NSDQ",
                      size: 10,
                      quoteTime: 1700000000123,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  test("updates local subscription state only after successful responses and clears on logout", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subs({
      service: "LEVELONE_EQUITIES",
      keys: ["aapl"],
      fields: ["0", "1", "2"],
    });
    await flushMicrotasks();
    const subsRequest = parseLastRequest(ws).requests[0];

    expect(streamer.getSubscriptionState()).toEqual({});

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });

    await subsPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ["AAPL"],
        fields: ["0", "1", "2"],
      },
    });

    const addPromise = streamer.add({
      service: "LEVELONE_EQUITIES",
      keys: ["MSFT"],
      fields: ["0", "1", "3"],
    });
    await flushMicrotasks();
    const addRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });
    await addPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ["AAPL", "MSFT"],
        fields: ["0", "1", "3"],
      },
    });

    const viewPromise = streamer.view({
      service: "LEVELONE_EQUITIES",
      fields: ["0", "8"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ["AAPL", "MSFT"],
        fields: ["0", "8"],
      },
    });

    const unsubsPromise = streamer.unsubs({
      service: "LEVELONE_EQUITIES",
      keys: ["AAPL"],
    });
    await flushMicrotasks();
    const unsubsRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "UNSUBS",
          requestid: unsubsRequest.requestid,
          timestamp: 5,
          content: {
            code: 27,
            msg: "UNSUBS command succeeded",
          },
        },
      ],
    });
    await unsubsPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ["MSFT"],
        fields: ["0", "8"],
      },
    });

    const logoutPromise = streamer.logout();
    await flushMicrotasks();
    const logoutRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: "ADMIN",
          command: "LOGOUT",
          requestid: logoutRequest.requestid,
          timestamp: 6,
          content: {
            code: 0,
            msg: "SUCCESS",
          },
        },
      ],
    });
    await logoutPromise;

    expect(streamer.getSubscriptionState()).toEqual({});
  });

  test("service-specific futures helpers resolve semantic field names to ids", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subsL1Futures({
      keys: ["/ESH26"],
      fields: [
        "symbol",
        "bidPrice",
        "askPrice",
        "lastPrice",
        "totalVolume",
        "quoteTime",
      ],
    });
    await flushMicrotasks();

    const subsRequest = parseLastRequest(ws).requests[0];
    expect(subsRequest.command).toBe("SUBS");
    expect(subsRequest.parameters).toEqual({
      keys: "/ESH26",
      fields: "0,1,2,3,8,10",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await subsPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_FUTURES: {
        keys: ["/ESH26"],
        fields: ["0", "1", "2", "3", "8", "10"],
      },
    });

    const addPromise = streamer.addL1Futures({
      keys: ["/ESM26"],
      fields: ["symbol", "bidPrice", "askPrice"],
    });
    await flushMicrotasks();

    const addRequest = parseLastRequest(ws).requests[0];
    expect(addRequest.command).toBe("ADD");
    expect(addRequest.parameters).toEqual({
      keys: "/ESM26",
      fields: "0,1,2",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });
    await addPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_FUTURES: {
        keys: ["/ESH26", "/ESM26"],
        fields: ["0", "1", "2"],
      },
    });

    const viewPromise = streamer.viewL1Futures({
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();

    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.command).toBe("VIEW");
    expect(viewRequest.parameters).toEqual({
      fields: "0,10",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_FUTURES: {
        keys: ["/ESH26", "/ESM26"],
        fields: ["0", "10"],
      },
    });
  });

  test("service-specific equities helpers resolve semantic field names to ids", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subsL1Equities({
      keys: ["AAPL"],
      fields: ["symbol", "bidPrice", "askPrice", "lastPrice", "quoteTime"],
    });
    await flushMicrotasks();

    const subsRequest = parseLastRequest(ws).requests[0];
    expect(subsRequest.command).toBe("SUBS");
    expect(subsRequest.parameters).toEqual({
      keys: "AAPL",
      fields: "0,1,2,3,34",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await subsPromise;

    const addPromise = streamer.addL1Equities({
      keys: ["MSFT"],
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const addRequest = parseLastRequest(ws).requests[0];
    expect(addRequest.parameters).toEqual({
      keys: "MSFT",
      fields: "0,34",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });
    await addPromise;

    const viewPromise = streamer.viewL1Equities({
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.parameters).toEqual({
      fields: "0,34",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_EQUITIES",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ["AAPL", "MSFT"],
        fields: ["0", "34"],
      },
    });
  });

  test("options service accepts raw numeric subscriptions and semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const rawSubsPromise = streamer.subs({
      service: "LEVELONE_OPTIONS",
      keys: ["AAPL  251219C00200000"],
      fields: ["0", "2", "3", "38"],
    });
    await flushMicrotasks();

    const rawSubsRequest = parseLastRequest(ws).requests[0];
    expect(rawSubsRequest.parameters).toEqual({
      keys: "AAPL  251219C00200000",
      fields: "0,2,3,38",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_OPTIONS",
          command: "SUBS",
          requestid: rawSubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await rawSubsPromise;

    const semanticSubsPromise = streamer.subsL1Options({
      keys: ["AAPL  251219P00190000"],
      fields: ["symbol", "bidPrice", "askPrice", "quoteTime"],
    });
    await flushMicrotasks();
    const semanticSubsRequest = parseLastRequest(ws).requests[0];
    expect(semanticSubsRequest.parameters).toEqual({
      keys: "AAPL  251219P00190000",
      fields: "0,2,3,38",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_OPTIONS",
          command: "SUBS",
          requestid: semanticSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await semanticSubsPromise;

    const addPromise = streamer.addL1Options({
      keys: ["AAPL  251219C00210000"],
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const addRequest = parseLastRequest(ws).requests[0];
    expect(addRequest.parameters).toEqual({
      keys: "AAPL  251219C00210000",
      fields: "0,38",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_OPTIONS",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 4,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });
    await addPromise;

    const viewPromise = streamer.viewL1Options({
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.parameters).toEqual({
      fields: "0,38",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_OPTIONS",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 5,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_OPTIONS: {
        keys: ["AAPL  251219P00190000", "AAPL  251219C00210000"],
        fields: ["0", "38"],
      },
    });
  });

  test("futures options service accepts raw numeric subscriptions and semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const rawSubsPromise = streamer.subs({
      service: "LEVELONE_FUTURES_OPTIONS",
      keys: ["./OZCZ23C565"],
      fields: ["0", "1", "2", "10"],
    });
    await flushMicrotasks();

    const rawSubsRequest = parseLastRequest(ws).requests[0];
    expect(rawSubsRequest.parameters).toEqual({
      keys: "./OZCZ23C565",
      fields: "0,1,2,10",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES_OPTIONS",
          command: "SUBS",
          requestid: rawSubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await rawSubsPromise;

    const semanticSubsPromise = streamer.subsL1FuturesOptions({
      keys: ["./OZCH24P540"],
      fields: ["symbol", "bidPrice", "askPrice", "quoteTime"],
    });
    await flushMicrotasks();
    const semanticSubsRequest = parseLastRequest(ws).requests[0];
    expect(semanticSubsRequest.parameters).toEqual({
      keys: "./OZCH24P540",
      fields: "0,1,2,10",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES_OPTIONS",
          command: "SUBS",
          requestid: semanticSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await semanticSubsPromise;

    const viewPromise = streamer.viewL1FuturesOptions({
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.parameters).toEqual({
      fields: "0,10",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES_OPTIONS",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_FUTURES_OPTIONS: {
        keys: ["./OZCH24P540"],
        fields: ["0", "10"],
      },
    });
  });

  test("forex service accepts raw numeric subscriptions and semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const rawSubsPromise = streamer.subs({
      service: "LEVELONE_FOREX",
      keys: ["EUR/USD"],
      fields: ["0", "1", "2", "8"],
    });
    await flushMicrotasks();

    const rawSubsRequest = parseLastRequest(ws).requests[0];
    expect(rawSubsRequest.parameters).toEqual({
      keys: "EUR/USD",
      fields: "0,1,2,8",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FOREX",
          command: "SUBS",
          requestid: rawSubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await rawSubsPromise;

    const semanticSubsPromise = streamer.subsL1Forex({
      keys: ["USD/JPY"],
      fields: ["symbol", "bidPrice", "askPrice", "quoteTime"],
    });
    await flushMicrotasks();
    const semanticSubsRequest = parseLastRequest(ws).requests[0];
    expect(semanticSubsRequest.parameters).toEqual({
      keys: "USD/JPY",
      fields: "0,1,2,8",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FOREX",
          command: "SUBS",
          requestid: semanticSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await semanticSubsPromise;

    const addPromise = streamer.addL1Forex({
      keys: ["AUD/CAD"],
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const addRequest = parseLastRequest(ws).requests[0];
    expect(addRequest.parameters).toEqual({
      keys: "AUD/CAD",
      fields: "0,8",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FOREX",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 4,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });
    await addPromise;

    const viewPromise = streamer.viewL1Forex({
      fields: ["symbol", "quoteTime"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.parameters).toEqual({
      fields: "0,8",
    });

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FOREX",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 5,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_FOREX: {
        keys: ["USD/JPY", "AUD/CAD"],
        fields: ["0", "8"],
      },
    });
  });

  test("NYSE book service accepts raw numeric subscriptions and semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const rawSubsPromise = streamer.subs({
      service: "NYSE_BOOK",
      keys: ["AAPL"],
      fields: ["0", "1", "2", "3"],
    });
    await flushMicrotasks();

    const rawSubsRequest = parseLastRequest(ws).requests[0];
    expect(rawSubsRequest.parameters).toEqual({
      keys: "AAPL",
      fields: "0,1,2,3",
    });

    ws.emitFrame({
      response: [
        {
          service: "NYSE_BOOK",
          command: "SUBS",
          requestid: rawSubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await rawSubsPromise;

    const semanticSubsPromise = streamer.subsL2NyseBook({
      keys: ["MSFT"],
      fields: ["symbol", "marketSnapshotTime", "bidSideLevels", "askSideLevels"],
    });
    await flushMicrotasks();
    const semanticSubsRequest = parseLastRequest(ws).requests[0];
    expect(semanticSubsRequest.parameters).toEqual({
      keys: "MSFT",
      fields: "0,1,2,3",
    });

    ws.emitFrame({
      response: [
        {
          service: "NYSE_BOOK",
          command: "SUBS",
          requestid: semanticSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await semanticSubsPromise;

    const viewPromise = streamer.viewL2NyseBook({
      fields: ["symbol", "bidSideLevels"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.parameters).toEqual({
      fields: "0,2",
    });

    ws.emitFrame({
      response: [
        {
          service: "NYSE_BOOK",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      NYSE_BOOK: {
        keys: ["MSFT"],
        fields: ["0", "2"],
      },
    });
  });

  test("NASDAQ book service accepts semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subsL2NasdaqBook({
      keys: ["TSLA"],
      fields: ["symbol", "marketSnapshotTime", "askSideLevels"],
    });
    await flushMicrotasks();
    const subsRequest = parseLastRequest(ws).requests[0];
    expect(subsRequest.parameters).toEqual({
      keys: "TSLA",
      fields: "0,1,3",
    });

    ws.emitFrame({
      response: [
        {
          service: "NASDAQ_BOOK",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await subsPromise;

    const addPromise = streamer.addL2NasdaqBook({
      keys: ["NVDA"],
      fields: ["symbol", "bidSideLevels"],
    });
    await flushMicrotasks();
    const addRequest = parseLastRequest(ws).requests[0];
    expect(addRequest.parameters).toEqual({
      keys: "NVDA",
      fields: "0,2",
    });

    ws.emitFrame({
      response: [
        {
          service: "NASDAQ_BOOK",
          command: "ADD",
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: "ADD command succeeded",
          },
        },
      ],
    });
    await addPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      NASDAQ_BOOK: {
        keys: ["TSLA", "NVDA"],
        fields: ["0", "2"],
      },
    });
  });

  test("OPTIONS book service accepts semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subsL2OptionsBook({
      keys: ["AAPL  251219C00200000"],
      fields: ["symbol", "marketSnapshotTime", "bidSideLevels", "askSideLevels"],
    });
    await flushMicrotasks();
    const subsRequest = parseLastRequest(ws).requests[0];
    expect(subsRequest.parameters).toEqual({
      keys: "AAPL  251219C00200000",
      fields: "0,1,2,3",
    });

    ws.emitFrame({
      response: [
        {
          service: "OPTIONS_BOOK",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await subsPromise;

    const viewPromise = streamer.viewL2OptionsBook({
      fields: ["symbol", "askSideLevels"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    expect(viewRequest.parameters).toEqual({
      fields: "0,3",
    });

    ws.emitFrame({
      response: [
        {
          service: "OPTIONS_BOOK",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 3,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      OPTIONS_BOOK: {
        keys: ["AAPL  251219C00200000"],
        fields: ["0", "3"],
      },
    });
  });

  test("chart services accept semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const equitySubsPromise = streamer.subsChartEquity({
      keys: ["AAPL"],
      fields: ["symbol", "openPrice", "chartTime"],
    });
    await flushMicrotasks();
    const equitySubsRequest = parseLastRequest(ws).requests[0];
    expect(equitySubsRequest.parameters).toEqual({
      keys: "AAPL",
      fields: "0,1,7",
    });

    ws.emitFrame({
      response: [
        {
          service: "CHART_EQUITY",
          command: "SUBS",
          requestid: equitySubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await equitySubsPromise;

    const futuresSubsPromise = streamer.subsChartFutures({
      keys: ["/ESH26"],
      fields: ["symbol", "chartTime", "closePrice"],
    });
    await flushMicrotasks();
    const futuresSubsRequest = parseLastRequest(ws).requests[0];
    expect(futuresSubsRequest.parameters).toEqual({
      keys: "/ESH26",
      fields: "0,1,5",
    });

    ws.emitFrame({
      response: [
        {
          service: "CHART_FUTURES",
          command: "SUBS",
          requestid: futuresSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await futuresSubsPromise;

    const equityViewPromise = streamer.viewChartEquity({
      fields: ["symbol", "chartTime"],
    });
    await flushMicrotasks();
    const equityViewRequest = parseLastRequest(ws).requests[0];
    expect(equityViewRequest.parameters).toEqual({
      fields: "0,7",
    });

    ws.emitFrame({
      response: [
        {
          service: "CHART_EQUITY",
          command: "VIEW",
          requestid: equityViewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await equityViewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      CHART_EQUITY: {
        keys: ["AAPL"],
        fields: ["0", "7"],
      },
      CHART_FUTURES: {
        keys: ["/ESH26"],
        fields: ["0", "1", "5"],
      },
    });
  });

  test("screener services accept semantic helpers", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const equitySubsPromise = streamer.subsScreenerEquity({
      keys: ["NYSE_VOLUME_0"],
      fields: ["symbol", "timestamp", "items"],
    });
    await flushMicrotasks();
    const equitySubsRequest = parseLastRequest(ws).requests[0];
    expect(equitySubsRequest.parameters).toEqual({
      keys: "NYSE_VOLUME_0",
      fields: "0,1,4",
    });

    ws.emitFrame({
      response: [
        {
          service: "SCREENER_EQUITY",
          command: "SUBS",
          requestid: equitySubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await equitySubsPromise;

    const optionSubsPromise = streamer.subsScreenerOption({
      keys: ["OPTION_CALL_VOLUME_0"],
      fields: ["symbol", "sortField", "items"],
    });
    await flushMicrotasks();
    const optionSubsRequest = parseLastRequest(ws).requests[0];
    expect(optionSubsRequest.parameters).toEqual({
      keys: "OPTION_CALL_VOLUME_0",
      fields: "0,2,4",
    });

    ws.emitFrame({
      response: [
        {
          service: "SCREENER_OPTION",
          command: "SUBS",
          requestid: optionSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await optionSubsPromise;

    const optionViewPromise = streamer.viewScreenerOption({
      fields: ["symbol", "items"],
    });
    await flushMicrotasks();
    const optionViewRequest = parseLastRequest(ws).requests[0];
    expect(optionViewRequest.parameters).toEqual({
      fields: "0,4",
    });

    ws.emitFrame({
      response: [
        {
          service: "SCREENER_OPTION",
          command: "VIEW",
          requestid: optionViewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await optionViewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      SCREENER_EQUITY: {
        keys: ["NYSE_VOLUME_0"],
        fields: ["0", "1", "4"],
      },
      SCREENER_OPTION: {
        keys: ["OPTION_CALL_VOLUME_0"],
        fields: ["0", "4"],
      },
    });
  });

  test("account activity accepts raw and semantic subscriptions", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const rawSubsPromise = streamer.subs({
      service: "ACCT_ACTIVITY",
      keys: ["CLIENT_KEY"],
      fields: ["0"],
    });
    await flushMicrotasks();
    const rawSubsRequest = parseLastRequest(ws).requests[0];
    expect(rawSubsRequest.parameters).toEqual({
      keys: "CLIENT_KEY",
      fields: "0",
    });

    ws.emitFrame({
      response: [
        {
          service: "ACCT_ACTIVITY",
          command: "SUBS",
          requestid: rawSubsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await rawSubsPromise;

    const semanticSubsPromise = streamer.subsAcctActivity({
      keys: ["CLIENT_OTHER_KEY"],
      fields: ["subscriptionKey"],
    });
    await flushMicrotasks();
    const semanticSubsRequest = parseLastRequest(ws).requests[0];
    expect(semanticSubsRequest.parameters).toEqual({
      keys: "CLIENT_OTHER_KEY",
      fields: "0",
    });

    ws.emitFrame({
      response: [
        {
          service: "ACCT_ACTIVITY",
          command: "SUBS",
          requestid: semanticSubsRequest.requestid,
          timestamp: 3,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await semanticSubsPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      ACCT_ACTIVITY: {
        keys: ["CLIENT_OTHER_KEY"],
        fields: ["0"],
      },
    });
  });

  test("mixed semantic and raw futures subscription calls keep numeric state coherent", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subsL1Futures({
      keys: ["/ESH26"],
      fields: ["symbol", "bidPrice", "quoteTime"],
    });
    await flushMicrotasks();
    const subsRequest = parseLastRequest(ws).requests[0];

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES",
          command: "SUBS",
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: "SUBS command succeeded",
          },
        },
      ],
    });
    await subsPromise;

    const viewPromise = streamer.view({
      service: "LEVELONE_FUTURES",
      fields: ["0", "10"],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];

    ws.emitFrame({
      response: [
        {
          service: "LEVELONE_FUTURES",
          command: "VIEW",
          requestid: viewRequest.requestid,
          timestamp: 3,
          content: {
            code: 29,
            msg: "VIEW command succeeded",
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_FUTURES: {
        keys: ["/ESH26"],
        fields: ["0", "10"],
      },
    });
  });

  test("logout followed by an expected websocket close does not surface an error", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const logoutPromise = streamer.logout();
    await flushMicrotasks();
    const logoutRequest = parseLastRequest(ws).requests[0];

    ws.emitFrame({
      response: [
        {
          service: "ADMIN",
          command: "LOGOUT",
          requestid: logoutRequest.requestid,
          timestamp: 6,
          content: {
            code: 0,
            msg: "SUCCESS",
          },
        },
      ],
    });

    await logoutPromise;
    ws.close();
    await flushMicrotasks();

    expect(streamer.connected).toBe(false);
    expect(streamer.loggedIn).toBe(false);
  });

  test("close forces publisher linger to zero and closes the socket", async () => {
    const { streamer } = await createConnectedStreamer();
    const publisher = streamer.publisher as {
      linger: number;
      close: ReturnType<typeof vi.fn>;
    };

    await streamer.close();

    expect(publisher.linger).toBe(0);
    expect(publisher.close).toHaveBeenCalledTimes(1);
    expect(streamer.publisher).toBeNull();
    expect(streamer.ws).toBeNull();
  });

  test("websocket close rejects any pending command", async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subs({
      service: "LEVELONE_EQUITIES",
      keys: ["AAPL"],
      fields: ["0", "1"],
    });
    await flushMicrotasks();

    ws.close();

    await expect(subsPromise).rejects.toThrow(
      "Schwab streamer websocket closed",
    );
    expect(streamer.connected).toBe(false);
    expect(streamer.loggedIn).toBe(false);
  });
});
