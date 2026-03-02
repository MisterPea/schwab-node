import type { Publisher } from 'zeromq';
import { WebSocket, type RawData } from 'ws';
import { getUserPreference } from '../../account/index.js';
import { getDefaultAuth } from '../../oauth/defaultAuth.js';
import { createPublisher, publish } from '../zmq/publisher.js';

const DEFAULT_PUBLISHER_ADDRESS = 'tcp://*:5555';
const DEFAULT_TOPIC_PREFIX = 'schwab';
const RESPONSE_TIMEOUT_MS = 15_000;
const SUCCESS_RESPONSE_CODES = new Set([0, 26, 27, 28, 29]);

export type StreamService = 'LEVELONE_EQUITIES'|'LEVELONE_FUTURES';
export type StreamCommand = 'LOGIN' | 'LOGOUT' | 'SUBS' | 'ADD' | 'UNSUBS' | 'VIEW';
type ServiceCommand = Exclude<StreamCommand, 'LOGIN' | 'LOGOUT'>;

export type SubscriptionInput = {
  service: StreamService;
  keys: string[];
  fields: string[];
};

export type UnsubscribeInput = {
  service: StreamService;
  keys: string[];
};

export type ViewInput = {
  service: StreamService;
  fields: string[];
};

export type SubscriptionState = {
  keys: string[];
  fields: string[];
};

type StreamerContext = {
  streamerSocketUrl: string;
  schwabClientCustomerId: string;
  schwabClientCorrelId: string;
  schwabClientChannel: string;
  schwabClientFunctionId: string;
  accessToken: string;
};

type StreamerRequest = {
  service: string;
  command: StreamCommand;
  requestid: string;
  SchwabClientCustomerId: string;
  SchwabClientCorrelId: string;
  parameters?: Record<string, string>;
};

type StreamerRequestEnvelope = {
  requests: StreamerRequest[];
};

type StreamerResponse = {
  service: string;
  command: StreamCommand;
  requestid: string;
  SchwabClientCorrelId?: string;
  timestamp?: number;
  content: {
    code: number;
    msg: string;
  };
};

type StreamerData = {
  service: string;
  command?: string;
  timestamp?: number;
  content: unknown;
};

type StreamerNotify = Record<string, unknown>;

type ParsedIncomingEntry =
  | { type: 'notify'; payload: StreamerNotify }
  | { type: 'response'; service: string; payload: StreamerResponse }
  | { type: 'data'; service: string; payload: StreamerData };

type ServiceRequestParams = {
  service: StreamService;
  keys?: string[];
  fields?: string[];
};

type PublishedMessage = {
  type: ParsedIncomingEntry['type'];
  receivedAt: number;
  payload: unknown;
};

type PendingRequest = {
  resolve: (response: StreamerResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type SubscriptionBucket = {
  keys: Set<string>;
  fields: string[];
};

function normalizeList(values: string[], transform?: (value: string) => string): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const nextValue = transform ? transform(value.trim()) : value.trim();
    if (!nextValue || seen.has(nextValue)) continue;
    seen.add(nextValue);
    normalized.push(nextValue);
  }

  return normalized;
}

function normalizeKeys(keys: string[]): string[] {
  return normalizeList(keys, (value) => value.toUpperCase());
}

function normalizeFields(fields: string[]): string[] {
  return normalizeList(fields);
}

async function loadStreamerContext(): Promise<StreamerContext> {
  const userPreference = await getUserPreference();
  const streamerInfo = userPreference.streamerInfo[0];

  if (!streamerInfo) {
    throw new Error('Streamer info not found in user preference response');
  }

  const { access_token: accessToken } = await getDefaultAuth().getAuth();
  if (!accessToken) {
    throw new Error('Access token not available');
  }

  return {
    streamerSocketUrl: streamerInfo.streamerSocketUrl,
    schwabClientCustomerId: streamerInfo.schwabClientCustomerId,
    schwabClientCorrelId: streamerInfo.schwabClientCorrelId,
    schwabClientChannel: streamerInfo.schwabClientChannel,
    schwabClientFunctionId: streamerInfo.schwabClientFunctionId,
    accessToken,
  };
}

function buildLoginRequest(context: StreamerContext, requestId: string): StreamerRequestEnvelope {
  return {
    requests: [
      {
        service: 'ADMIN',
        command: 'LOGIN',
        requestid: requestId,
        SchwabClientCustomerId: context.schwabClientCustomerId,
        SchwabClientCorrelId: context.schwabClientCorrelId,
        parameters: {
          Authorization: context.accessToken,
          SchwabClientChannel: context.schwabClientChannel,
          SchwabClientFunctionId: context.schwabClientFunctionId,
        },
      },
    ],
  };
}

function buildLogoutRequest(context: StreamerContext, requestId: string): StreamerRequestEnvelope {
  return {
    requests: [
      {
        service: 'ADMIN',
        command: 'LOGOUT',
        requestid: requestId,
        SchwabClientCustomerId: context.schwabClientCustomerId,
        SchwabClientCorrelId: context.schwabClientCorrelId,
        parameters: {},
      },
    ],
  };
}

function buildServiceRequest(
  context: StreamerContext,
  requestId: string,
  command: ServiceCommand,
  params: ServiceRequestParams,
): StreamerRequestEnvelope {
  if (!['LEVELONE_EQUITIES','LEVELONE_FUTURES'].includes(params.service) ) {
    throw new Error(`Unsupported stream service: ${params.service}`);
  }

  const normalizedKeys = params.keys ? normalizeKeys(params.keys) : undefined;
  const normalizedFields = params.fields ? normalizeFields(params.fields) : undefined;
  const requestParams: Record<string, string> = {};

  if (normalizedKeys && normalizedKeys.length > 0) {
    requestParams.keys = normalizedKeys.join(',');
  }

  if (normalizedFields && normalizedFields.length > 0) {
    requestParams.fields = normalizedFields.join(',');
  }

  return {
    requests: [
      {
        service: params.service,
        command,
        requestid: requestId,
        SchwabClientCustomerId: context.schwabClientCustomerId,
        SchwabClientCorrelId: context.schwabClientCorrelId,
        parameters: requestParams,
      },
    ],
  };
}

function rawDataToString(raw: RawData): string {
  if (typeof raw === 'string') return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return raw.toString('utf8');
}

function parseIncomingFrame(raw: RawData): ParsedIncomingEntry[] {
  const frame = JSON.parse(rawDataToString(raw)) as {
    notify?: StreamerNotify[];
    response?: StreamerResponse[];
    data?: StreamerData[];
  };

  const parsed: ParsedIncomingEntry[] = [];

  for (const notify of frame.notify ?? []) {
    parsed.push({ type: 'notify', payload: notify });
  }

  for (const response of frame.response ?? []) {
    parsed.push({
      type: 'response',
      service: response.service,
      payload: response,
    });
  }

  for (const data of frame.data ?? []) {
    parsed.push({
      type: 'data',
      service: data.service,
      payload: data,
    });
  }

  return parsed;
}

export const __streamerInternals = {
  loadStreamerContext,
  buildLoginRequest,
  buildLogoutRequest,
  buildServiceRequest,
  parseIncomingFrame,
};

export class SchwabStreamer {
  ws: WebSocket | null = null;
  publisher: Publisher | null = null;
  connected = false;
  loggedIn = false;
  closed = false;

  private readonly publisherAddress: string;
  private readonly topicPrefix: string;
  private context: StreamerContext | null = null;
  private requestCounter = 0;
  private commandChain: Promise<void> = Promise.resolve();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly subscriptionState = new Map<StreamService, SubscriptionBucket>();

  constructor(options: { publisherAddress?: string; topicPrefix?: string } = {}) {
    this.publisherAddress = options.publisherAddress ?? DEFAULT_PUBLISHER_ADDRESS;
    this.topicPrefix = options.topicPrefix ?? DEFAULT_TOPIC_PREFIX;
  }

  async connect(): Promise<void> {
    this.ensureNotClosed();

    if (this.connected) return;

    this.context ??= await loadStreamerContext();
    this.publisher ??= await createPublisher(this.publisherAddress);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.context!.streamerSocketUrl);
      this.ws = ws;
      this.installSocketHandlers(ws);

      const handleOpen = () => {
        cleanup();
        this.connected = true;
        resolve();
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(this.toError(error, 'Failed to connect to Schwab streamer'));
      };

      const cleanup = () => {
        ws.off('open', handleOpen);
        ws.off('error', handleError);
      };

      ws.once('open', handleOpen);
      ws.once('error', handleError);
    });
  }

  async login(): Promise<void> {
    return this.enqueueCommand(async () => {
      if (this.loggedIn) return;

      this.ensureConnected();
      const context = this.requireContext();
      const requestId = this.nextRequestId();

      await this.sendRequestAndAwaitResponse(buildLoginRequest(context, requestId), requestId);
      this.loggedIn = true;
    });
  }

  async logout(): Promise<void> {
    return this.enqueueCommand(async () => {
      if (!this.connected || !this.ws || !this.loggedIn) {
        this.loggedIn = false;
        this.subscriptionState.clear();
        return;
      }

      const context = this.requireContext();
      const requestId = this.nextRequestId();

      await this.sendRequestAndAwaitResponse(buildLogoutRequest(context, requestId), requestId);
      this.loggedIn = false;
      this.subscriptionState.clear();
    });
  }

  async subs(input: SubscriptionInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeSubscriptionInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, 'SUBS', normalized),
        requestId,
      );

      this.subscriptionState.set(normalized.service, {
        keys: new Set(normalized.keys),
        fields: [...normalized.fields],
      });
    });
  }

  async add(input: SubscriptionInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeSubscriptionInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, 'ADD', normalized),
        requestId,
      );

      const existing = this.subscriptionState.get(normalized.service) ?? {
        keys: new Set<string>(),
        fields: [],
      };

      for (const key of normalized.keys) {
        existing.keys.add(key);
      }

      existing.fields = [...normalized.fields];
      this.subscriptionState.set(normalized.service, existing);
    });
  }

  async unsubs(input: UnsubscribeInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeUnsubscribeInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, 'UNSUBS', normalized),
        requestId,
      );

      const existing = this.subscriptionState.get(normalized.service);
      if (!existing) return;

      for (const key of normalized.keys ?? []) {
        existing.keys.delete(key);
      }
    });
  }

  async view(input: ViewInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeViewInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, 'VIEW', normalized),
        requestId,
      );

      const existing = this.subscriptionState.get(normalized.service) ?? {
        keys: new Set<string>(),
        fields: [],
      };

      existing.fields = [...(normalized.fields ?? [])];
      this.subscriptionState.set(normalized.service, existing);
    });
  }

  getSubscriptionState(): Record<string, SubscriptionState> {
    const state: Record<string, SubscriptionState> = {};

    for (const [service, subscription] of this.subscriptionState.entries()) {
      state[service] = {
        keys: [...subscription.keys],
        fields: [...subscription.fields],
      };
    }

    return state;
  }

  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;
    this.connected = false;
    this.loggedIn = false;
    this.subscriptionState.clear();
    this.rejectPendingRequests(new Error('Streamer closed'));

    const ws = this.ws;
    this.ws = null;

    if (ws && ws.readyState !== WebSocket.CLOSED) {
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        ws.close();
      });
    }

    if (this.publisher) {
      await this.publisher.close();
      this.publisher = null;
    }
  }

  private ensureNotClosed(): void {
    if (this.closed) {
      throw new Error('Streamer is closed');
    }
  }

  private ensureConnected(): void {
    this.ensureNotClosed();

    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Streamer is not connected');
    }
  }

  private ensureLoggedIn(): void {
    this.ensureConnected();

    if (!this.loggedIn) {
      throw new Error('Streamer must be logged in before sending service commands');
    }
  }

  private requireContext(): StreamerContext {
    if (!this.context) {
      throw new Error('Streamer context has not been loaded');
    }

    return this.context;
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `${this.requestCounter}`;
  }

  private enqueueCommand<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.commandChain.then(operation);
    this.commandChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async sendRequestAndAwaitResponse(
    payload: StreamerRequestEnvelope,
    requestId: string,
  ): Promise<StreamerResponse> {
    this.ensureConnected();
    const ws = this.ws!;

    return new Promise<StreamerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Timed out waiting for response to request ${requestId}`));
      }, RESPONSE_TIMEOUT_MS);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      try {
        ws.send(JSON.stringify(payload));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(this.toError(error, `Failed to send request ${requestId}`));
      }
    });
  }

  private installSocketHandlers(ws: WebSocket): void {
    ws.on('message', (raw) => {
      void this.handleIncomingFrame(raw).catch((error) => {
        this.rejectPendingRequests(this.toError(error, 'Failed to handle inbound streamer frame'));
      });
    });

    ws.on('close', () => {
      this.handleSocketTermination(ws, new Error('Schwab streamer websocket closed'));
    });

    ws.on('error', (error) => {
      this.handleSocketTermination(ws, this.toError(error, 'Schwab streamer websocket error'));
    });
  }

  private async handleIncomingFrame(raw: RawData): Promise<void> {
    const receivedAt = Date.now();
    const entries = parseIncomingFrame(raw);

    for (const entry of entries) {
      await this.publishEntry(entry, receivedAt);

      if (entry.type !== 'response') continue;

      const pending = this.pendingRequests.get(entry.payload.requestid);
      if (!pending) continue;

      this.pendingRequests.delete(entry.payload.requestid);

      if (SUCCESS_RESPONSE_CODES.has(entry.payload.content.code)) {
        pending.resolve(entry.payload);
      } else {
        pending.reject(
          new Error(
            `Streamer command ${entry.payload.command} failed (${entry.payload.content.code}): ${entry.payload.content.msg}`,
          ),
        );
      }
    }
  }

  private async publishEntry(entry: ParsedIncomingEntry, receivedAt: number): Promise<void> {
    if (!this.publisher) return;

    const message: PublishedMessage = {
      type: entry.type,
      receivedAt,
      payload: entry.payload,
    };

    await publish(this.publisher, this.topicFor(entry), message);
  }

  private topicFor(entry: ParsedIncomingEntry): string {
    if (entry.type === 'notify') {
      return `${this.topicPrefix}.notify`;
    }

    return `${this.topicPrefix}.${entry.type}.${entry.service}`;
  }

  private handleSocketTermination(ws: WebSocket, error: Error): void {
    if (this.ws === ws) {
      this.ws = null;
    }

    this.connected = false;
    this.loggedIn = false;
    this.rejectPendingRequests(error);
  }

  private rejectPendingRequests(error: Error): void {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(requestId);
    }
  }

  private normalizeSubscriptionInput(input: SubscriptionInput): ServiceRequestParams & {
    keys: string[];
    fields: string[];
  } {
    const keys = normalizeKeys(input.keys);
    const fields = normalizeFields(input.fields);

    if (keys.length === 0) {
      throw new Error('Subscription requires at least one symbol key');
    }

    if (fields.length === 0) {
      throw new Error('Subscription requires at least one field');
    }

    return {
      service: input.service,
      keys,
      fields,
    };
  }

  private normalizeUnsubscribeInput(input: UnsubscribeInput): ServiceRequestParams & { keys: string[] } {
    const keys = normalizeKeys(input.keys);

    if (keys.length === 0) {
      throw new Error('Unsubscribe requires at least one symbol key');
    }

    return {
      service: input.service,
      keys,
    };
  }

  private normalizeViewInput(input: ViewInput): ServiceRequestParams & { fields: string[] } {
    const fields = normalizeFields(input.fields);

    if (fields.length === 0) {
      throw new Error('View requires at least one field');
    }

    return {
      service: input.service,
      fields,
    };
  }

  private toError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error) return error;
    return new Error(fallbackMessage);
  }
}
