import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
    private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

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
        throw new Error('Socket is not open');
      }

      this.sent.push(data);
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close');
    }

    emitOpen(): void {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }

    emitFrame(payload: unknown): void {
      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.emit('message', raw, false);
    }

    emitSocketError(error = new Error('socket error')): void {
      this.emit('error', error);
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

vi.mock('ws', () => ({
  WebSocket: MockWebSocket,
}));

vi.mock('../src/account/index.js', () => ({
  getUserPreference: mockGetUserPreference,
}));

vi.mock('../src/oauth/defaultAuth.js', () => ({
  getDefaultAuth: mockGetDefaultAuth,
}));

vi.mock('../src/streaming/zmq/publisher.js', () => ({
  createPublisher: mockCreatePublisher,
  publish: mockPublish,
}));

function defaultUserPreference() {
  return {
    accounts: [],
    offers: [],
    streamerInfo: [
      {
        streamerSocketUrl: 'wss://streamer.test/ws',
        schwabClientCustomerId: 'customer-1',
        schwabClientCorrelId: 'correl-1',
        schwabClientChannel: 'N9',
        schwabClientFunctionId: 'APIAPP',
      },
    ],
  };
}

function parseLastRequest(ws: InstanceType<typeof MockWebSocket>) {
  return JSON.parse(ws.sent.at(-1) ?? '{}') as {
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
  return import('../src/streaming/websocket/index.js');
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
  streamer: Awaited<ReturnType<typeof createConnectedStreamer>>['streamer'],
  ws: InstanceType<typeof MockWebSocket>,
): Promise<void> {
  const loginPromise = streamer.login();
  await flushMicrotasks();
  const loginRequest = parseLastRequest(ws).requests[0];

  ws.emitFrame({
    response: [
      {
        service: 'ADMIN',
        command: 'LOGIN',
        requestid: loginRequest.requestid,
        SchwabClientCorrelId: 'correl-1',
        timestamp: 1,
        content: {
          code: 0,
          msg: 'server=test;status=PN',
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
    access_token: 'token-123',
    token_type: 'Bearer',
  });
  mockGetDefaultAuth.mockReturnValue({
    getAuth: mockGetAuth,
  });
  mockCreatePublisher.mockResolvedValue({
    close: vi.fn().mockResolvedValue(undefined),
  });
  mockPublish.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('SchwabStreamer', () => {
  test('buildLoginRequest wraps the Schwab login payload in requests[]', async () => {
    const { __streamerInternals } = await loadStreamerModule();

    const request = __streamerInternals.buildLoginRequest(
      {
        streamerSocketUrl: 'wss://streamer.test/ws',
        schwabClientCustomerId: 'customer-1',
        schwabClientCorrelId: 'correl-1',
        schwabClientChannel: 'N9',
        schwabClientFunctionId: 'APIAPP',
        accessToken: 'token-123',
      },
      '1',
    );

    expect(request).toEqual({
      requests: [
        {
          service: 'ADMIN',
          command: 'LOGIN',
          requestid: '1',
          SchwabClientCustomerId: 'customer-1',
          SchwabClientCorrelId: 'correl-1',
          parameters: {
            Authorization: 'token-123',
            SchwabClientChannel: 'N9',
            SchwabClientFunctionId: 'APIAPP',
          },
        },
      ],
    });
  });

  test('connect waits for websocket open and does not send login automatically', async () => {
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
    expect(mockCreatePublisher).toHaveBeenCalledWith('tcp://*:5555');
  });

  test('login sends ADMIN/LOGIN and waits for the matching response id', async () => {
    const { streamer, ws } = await createConnectedStreamer();

    let resolved = false;
    const loginPromise = streamer.login().then(() => {
      resolved = true;
    });
    await flushMicrotasks();

    const loginRequest = parseLastRequest(ws).requests[0];
    expect(loginRequest.command).toBe('LOGIN');

    ws.emitFrame({
      response: [
        {
          service: 'ADMIN',
          command: 'LOGIN',
          requestid: '999',
          SchwabClientCorrelId: 'correl-1',
          timestamp: 1,
          content: {
            code: 0,
            msg: 'server=test;status=PN',
          },
        },
      ],
    });

    await flushMicrotasks();
    expect(resolved).toBe(false);

    ws.emitFrame({
      response: [
        {
          service: 'ADMIN',
          command: 'LOGIN',
          requestid: loginRequest.requestid,
          SchwabClientCorrelId: 'correl-1',
          timestamp: 2,
          content: {
            code: 0,
            msg: 'server=test;status=PN',
          },
        },
      ],
    });

    await loginPromise;

    expect(streamer.loggedIn).toBe(true);
    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      'schwab.response.ADMIN',
      expect.objectContaining({
        type: 'response',
        payload: expect.objectContaining({
          command: 'LOGIN',
          requestid: loginRequest.requestid,
        }),
      }),
    );
  });

  test('subs rejects before login', async () => {
    const { streamer } = await createConnectedStreamer();

    await expect(
      streamer.subs({
        service: 'LEVELONE_EQUITIES',
        keys: ['AAPL'],
        fields: ['0', '1'],
      }),
    ).rejects.toThrow('Streamer must be logged in before sending service commands');
  });

  test('service commands run serially instead of overlapping', async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subs({
      service: 'LEVELONE_EQUITIES',
      keys: ['AAPL'],
      fields: ['0', '1', '2'],
    });

    const addPromise = streamer.add({
      service: 'LEVELONE_EQUITIES',
      keys: ['MSFT'],
      fields: ['0', '1', '2'],
    });
    await flushMicrotasks();

    expect(parseLastRequest(ws).requests[0].command).toBe('SUBS');
    expect(ws.sent).toHaveLength(2);

    const subsRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'SUBS',
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: 'SUBS command succeeded',
          },
        },
      ],
    });

    await flushMicrotasks();

    expect(ws.sent).toHaveLength(3);
    expect(parseLastRequest(ws).requests[0].command).toBe('ADD');

    const addRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'ADD',
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: 'ADD command succeeded',
          },
        },
      ],
    });

    await Promise.all([subsPromise, addPromise]);
  });

  test('non-success response codes reject the waiting command', async () => {
    const { streamer, ws } = await createConnectedStreamer();

    const loginPromise = streamer.login();
    await flushMicrotasks();
    const loginRequest = parseLastRequest(ws).requests[0];

    ws.emitFrame({
      response: [
        {
          service: 'ADMIN',
          command: 'LOGIN',
          requestid: loginRequest.requestid,
          timestamp: 1,
          content: {
            code: 3,
            msg: 'Login Denied.: token is invalid or has expired.',
          },
        },
      ],
    });

    await expect(loginPromise).rejects.toThrow('Streamer command LOGIN failed (3)');
    expect(streamer.loggedIn).toBe(false);
  });

  test('publishes notify and data frames to stable ZMQ topics', async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    ws.emitFrame({
      notify: [
        {
          heartbeat: '12345',
        },
      ],
      data: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'SUBS',
          timestamp: 10,
          content: [{ key: 'AAPL', '1': 100 }],
        },
      ],
    });

    await flushMicrotasks();

    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      'schwab.notify',
      expect.objectContaining({
        type: 'notify',
        payload: {
          heartbeat: '12345',
        },
      }),
    );

    expect(mockPublish).toHaveBeenCalledWith(
      expect.anything(),
      'schwab.data.LEVELONE_EQUITIES',
      expect.objectContaining({
        type: 'data',
        payload: expect.objectContaining({
          service: 'LEVELONE_EQUITIES',
        }),
      }),
    );
    expect(streamer.getSubscriptionState()).toEqual({});
  });

  test('updates local subscription state only after successful responses and clears on logout', async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subs({
      service: 'LEVELONE_EQUITIES',
      keys: ['aapl'],
      fields: ['0', '1', '2'],
    });
    await flushMicrotasks();
    const subsRequest = parseLastRequest(ws).requests[0];

    expect(streamer.getSubscriptionState()).toEqual({});

    ws.emitFrame({
      response: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'SUBS',
          requestid: subsRequest.requestid,
          timestamp: 2,
          content: {
            code: 26,
            msg: 'SUBS command succeeded',
          },
        },
      ],
    });

    await subsPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ['AAPL'],
        fields: ['0', '1', '2'],
      },
    });

    const addPromise = streamer.add({
      service: 'LEVELONE_EQUITIES',
      keys: ['MSFT'],
      fields: ['0', '1', '3'],
    });
    await flushMicrotasks();
    const addRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'ADD',
          requestid: addRequest.requestid,
          timestamp: 3,
          content: {
            code: 28,
            msg: 'ADD command succeeded',
          },
        },
      ],
    });
    await addPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ['AAPL', 'MSFT'],
        fields: ['0', '1', '3'],
      },
    });

    const viewPromise = streamer.view({
      service: 'LEVELONE_EQUITIES',
      fields: ['0', '8'],
    });
    await flushMicrotasks();
    const viewRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'VIEW',
          requestid: viewRequest.requestid,
          timestamp: 4,
          content: {
            code: 29,
            msg: 'VIEW command succeeded',
          },
        },
      ],
    });
    await viewPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ['AAPL', 'MSFT'],
        fields: ['0', '8'],
      },
    });

    const unsubsPromise = streamer.unsubs({
      service: 'LEVELONE_EQUITIES',
      keys: ['AAPL'],
    });
    await flushMicrotasks();
    const unsubsRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: 'LEVELONE_EQUITIES',
          command: 'UNSUBS',
          requestid: unsubsRequest.requestid,
          timestamp: 5,
          content: {
            code: 27,
            msg: 'UNSUBS command succeeded',
          },
        },
      ],
    });
    await unsubsPromise;

    expect(streamer.getSubscriptionState()).toEqual({
      LEVELONE_EQUITIES: {
        keys: ['MSFT'],
        fields: ['0', '8'],
      },
    });

    const logoutPromise = streamer.logout();
    await flushMicrotasks();
    const logoutRequest = parseLastRequest(ws).requests[0];
    ws.emitFrame({
      response: [
        {
          service: 'ADMIN',
          command: 'LOGOUT',
          requestid: logoutRequest.requestid,
          timestamp: 6,
          content: {
            code: 0,
            msg: 'SUCCESS',
          },
        },
      ],
    });
    await logoutPromise;

    expect(streamer.getSubscriptionState()).toEqual({});
  });

  test('websocket close rejects any pending command', async () => {
    const { streamer, ws } = await createConnectedStreamer();
    await loginStreamer(streamer, ws);

    const subsPromise = streamer.subs({
      service: 'LEVELONE_EQUITIES',
      keys: ['AAPL'],
      fields: ['0', '1'],
    });
    await flushMicrotasks();

    ws.close();

    await expect(subsPromise).rejects.toThrow('Schwab streamer websocket closed');
    expect(streamer.connected).toBe(false);
    expect(streamer.loggedIn).toBe(false);
  });
});
