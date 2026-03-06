import type { Publisher } from "zeromq";
import { WebSocket, type RawData } from "ws";
import { getUserPreference } from "../../account/index.js";
import { getDefaultAuth } from "../../oauth/defaultAuth.js";
import { adapter } from "../zmq/adapter.js";
import { createPublisher, publish } from "../zmq/publisher.js";
import {
  type ParsedIncomingEntry,
  type PublishedMessage,
  type ServiceCommand,
  type ServiceRequestParams,
  type StreamCommand,
  type StreamerContext,
  StreamerFrameSchema,
  type StreamerRequestEnvelope,
  type StreamerResponse,
  type StreamService,
  type SubscriptionInput,
  type SubscriptionState,
  type UnsubscribeInput,
  type ViewInput,
} from "./schema.js";
import {
  resolveAcctActivityFieldNames,
  resolveChartEquityFieldNames,
  resolveChartFuturesFieldNames,
  resolveBookFieldNames,
  resolveScreenerFieldNames,
  resolveLevelOneEquitiesFieldNames,
  resolveLevelOneForexFieldNames,
  resolveLevelOneOptionsFieldNames,
  resolveLevelOneFuturesOptionsFieldNames,
  resolveLevelOneFuturesFieldNames,
  type AcctActivityFieldId,
  type AcctActivityFieldName,
  type AcctActivitySubscriptionInput,
  type ChartEquityFieldId,
  type ChartEquityFieldName,
  type ChartEquitySubscriptionInput,
  type ChartEquityViewInput,
  type ChartFuturesFieldId,
  type ChartFuturesFieldName,
  type ChartFuturesSubscriptionInput,
  type ChartFuturesViewInput,
  type BookFieldId,
  type BookFieldName,
  type BookMarketMakerFieldId,
  type BookMarketMakerFieldName,
  type BookPriceLevelFieldId,
  type BookPriceLevelFieldName,
  type ScreenerEquitySubscriptionInput,
  type ScreenerEquityViewInput,
  type ScreenerFieldId,
  type ScreenerFieldName,
  type ScreenerOptionSubscriptionInput,
  type ScreenerOptionViewInput,
  type L2NasdaqBookSubscriptionInput,
  type L2NasdaqBookViewInput,
  type L2NyseBookSubscriptionInput,
  type L2NyseBookViewInput,
  type L2OptionsBookSubscriptionInput,
  type L2OptionsBookViewInput,
  type LevelOneEquitiesSubscriptionInput,
  type LevelOneEquitiesViewInput,
  type LevelOneForexSubscriptionInput,
  type LevelOneForexViewInput,
  type LevelOneFuturesSubscriptionInput,
  type LevelOneFuturesOptionsSubscriptionInput,
  type LevelOneFuturesOptionsViewInput,
  type LevelOneFuturesViewInput,
  type LevelOneOptionsSubscriptionInput,
  type LevelOneOptionsViewInput,
} from "./fields.js";

export type {
  StreamCommand,
  StreamService,
  SubscriptionInput,
  SubscriptionState,
  UnsubscribeInput,
  ViewInput,
} from "./schema.js";
export {
  ACCT_ACTIVITY_FIELDS,
  ACCT_ACTIVITY_FIELD_IDS_BY_NAME,
  BOOK_FIELDS,
  BOOK_FIELD_IDS_BY_NAME,
  BOOK_MARKET_MAKER_FIELDS,
  BOOK_MARKET_MAKER_FIELD_IDS_BY_NAME,
  BOOK_PRICE_LEVEL_FIELDS,
  BOOK_PRICE_LEVEL_FIELD_IDS_BY_NAME,
  CHART_EQUITY_FIELDS,
  CHART_EQUITY_FIELD_IDS_BY_NAME,
  CHART_FUTURES_FIELDS,
  CHART_FUTURES_FIELD_IDS_BY_NAME,
  LEVELONE_EQUITIES_FIELDS,
  LEVELONE_EQUITIES_FIELD_IDS_BY_NAME,
  LEVELONE_OPTIONS_FIELDS,
  LEVELONE_OPTIONS_FIELD_IDS_BY_NAME,
  LEVELONE_FUTURES_FIELDS,
  LEVELONE_FUTURES_FIELD_IDS_BY_NAME,
  LEVELONE_FUTURES_OPTIONS_FIELDS,
  LEVELONE_FUTURES_OPTIONS_FIELD_IDS_BY_NAME,
  LEVELONE_FOREX_FIELDS,
  LEVELONE_FOREX_FIELD_IDS_BY_NAME,
  SCREENER_FIELDS,
  SCREENER_FIELD_IDS_BY_NAME,
  resolveFieldIds,
  resolveFieldNames,
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
  resolveLevelOneOptionsFieldIds,
  resolveLevelOneOptionsFieldNames,
  resolveScreenerFieldIds,
  resolveScreenerFieldNames,
} from "./fields.js";
export type {
  AcctActivityFieldId,
  AcctActivityFieldName,
  AcctActivitySubscriptionInput,
  BookFieldId,
  BookFieldName,
  BookMarketMakerFieldId,
  BookMarketMakerFieldName,
  BookPriceLevelFieldId,
  BookPriceLevelFieldName,
  ChartEquityFieldId,
  ChartEquityFieldName,
  ChartEquitySubscriptionInput,
  ChartEquityViewInput,
  ChartFuturesFieldId,
  ChartFuturesFieldName,
  ChartFuturesSubscriptionInput,
  ChartFuturesViewInput,
  L2NasdaqBookSubscriptionInput,
  L2NasdaqBookViewInput,
  L2NyseBookSubscriptionInput,
  L2NyseBookViewInput,
  L2OptionsBookSubscriptionInput,
  L2OptionsBookViewInput,
  ScreenerEquitySubscriptionInput,
  ScreenerEquityViewInput,
  ScreenerFieldId,
  ScreenerFieldName,
  ScreenerOptionSubscriptionInput,
  ScreenerOptionViewInput,
  LevelOneEquitiesFieldId,
  LevelOneEquitiesFieldName,
  LevelOneEquitiesSubscriptionInput,
  LevelOneEquitiesViewInput,
  LevelOneForexFieldId,
  LevelOneForexFieldName,
  LevelOneForexSubscriptionInput,
  LevelOneForexViewInput,
  LevelOneFuturesFieldId,
  LevelOneFuturesFieldName,
  LevelOneFuturesSubscriptionInput,
  LevelOneFuturesOptionsFieldId,
  LevelOneFuturesOptionsFieldName,
  LevelOneFuturesOptionsSubscriptionInput,
  LevelOneFuturesOptionsViewInput,
  LevelOneFuturesViewInput,
  LevelOneOptionsFieldId,
  LevelOneOptionsFieldName,
  LevelOneOptionsSubscriptionInput,
  LevelOneOptionsViewInput,
} from "./fields.js";

const DEFAULT_PUBLISHER_ADDRESS = "tcp://*:5555";
const DEFAULT_TOPIC_PREFIX = "schwab";
const RESPONSE_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 1_000;
const SUCCESS_RESPONSE_CODES = new Set([0, 26, 27, 28, 29]);

type PendingRequest = {
  resolve: (response: StreamerResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type SubscriptionBucket = {
  keys: Set<string>;
  fields: string[];
};

/**
 * Trims, de-duplicates, and optionally transforms a list of string values.
 * @param {string[]} values Raw values to normalize.
 * @param {(value: string) => string} [transform] Optional transform applied after trimming.
 * @returns {string[]} A normalized list with duplicates and empty entries removed.
 */
function normalizeList(
  values: string[],
  transform?: (value: string) => string,
): string[] {
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

/**
 * Normalizes Schwab symbol keys by trimming, uppercase-ing, and de-duplicating them.
 * @param {string[]} keys Symbol keys to normalize.
 * @returns {string[]} Normalized symbol keys.
 */
function normalizeKeys(keys: string[]): string[] {
  return normalizeList(keys, (value) => value.toUpperCase());
}

/**
 * Normalizes requested field identifiers by trimming and de-duplicating them.
 * @param {string[]} fields Requested field identifiers.
 * @returns {string[]} Normalized field identifiers.
 */
function normalizeFields(fields: string[]): string[] {
  return normalizeList(fields);
}

/**
 * Loads the websocket connection context from user preferences and OAuth auth.
 * @returns {Promise<StreamerContext>} Streamer connection metadata and access token.
 */
async function loadStreamerContext(): Promise<StreamerContext> {
  const userPreference = await getUserPreference();
  const streamerInfo = userPreference.streamerInfo[0];

  if (!streamerInfo) {
    throw new Error("Streamer info not found in user preference response");
  }

  const { access_token: accessToken } = await getDefaultAuth().getAuth();
  if (!accessToken) {
    throw new Error("Access token not available");
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

/**
 * Builds the Schwab `ADMIN/LOGIN` request envelope.
 * @param {StreamerContext} context Streamer session context and auth values.
 * @param {string} requestId Unique request identifier for this command.
 * @returns {StreamerRequestEnvelope} A Schwab request envelope containing one login command.
 */
function buildLoginRequest(
  context: StreamerContext,
  requestId: string,
): StreamerRequestEnvelope {
  return {
    requests: [
      {
        service: "ADMIN",
        command: "LOGIN",
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

/**
 * Builds the Schwab `ADMIN/LOGOUT` request envelope.
 * @param {StreamerContext} context Streamer session context and auth values.
 * @param {string} requestId Unique request identifier for this command.
 * @returns {StreamerRequestEnvelope} A Schwab request envelope containing one logout command.
 */
function buildLogoutRequest(
  context: StreamerContext,
  requestId: string,
): StreamerRequestEnvelope {
  return {
    requests: [
      {
        service: "ADMIN",
        command: "LOGOUT",
        requestid: requestId,
        SchwabClientCustomerId: context.schwabClientCustomerId,
        SchwabClientCorrelId: context.schwabClientCorrelId,
        parameters: {},
      },
    ],
  };
}

/**
 * Builds a service-level Schwab request such as `SUBS`, `ADD`, `UNSUBS`, or `VIEW`.
 * @param {StreamerContext} context Streamer session context and auth values.
 * @param {string} requestId Unique request identifier for this command.
 * @param {ServiceCommand} command Service command to send.
 * @param {ServiceRequestParams} params Service-specific request parameters.
 * @returns {StreamerRequestEnvelope} A Schwab request envelope for the requested service command.
 */
function buildServiceRequest(
  context: StreamerContext,
  requestId: string,
  command: ServiceCommand,
  params: ServiceRequestParams,
): StreamerRequestEnvelope {
  if (
    !["LEVELONE_EQUITIES", "LEVELONE_OPTIONS", "LEVELONE_FUTURES"].includes(
      params.service,
    ) &&
    ![
      "LEVELONE_FUTURES_OPTIONS",
      "LEVELONE_FOREX",
      "NYSE_BOOK",
      "NASDAQ_BOOK",
      "OPTIONS_BOOK",
      "CHART_EQUITY",
      "CHART_FUTURES",
      "SCREENER_EQUITY",
      "SCREENER_OPTION",
      "ACCT_ACTIVITY",
    ].includes(
      params.service,
    )
  ) {
    throw new Error(`Unsupported stream service: ${params.service}`);
  }

  const normalizedKeys = params.keys ? normalizeKeys(params.keys) : undefined;
  const normalizedFields = params.fields
    ? normalizeFields(params.fields)
    : undefined;
  const requestParams: Record<string, string> = {};

  if (normalizedKeys && normalizedKeys.length > 0) {
    requestParams.keys = normalizedKeys.join(",");
  }

  if (normalizedFields && normalizedFields.length > 0) {
    requestParams.fields = normalizedFields.join(",");
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

/**
 * Converts websocket frame data into a UTF-8 string for JSON parsing.
 * @param {RawData} raw Raw websocket payload from `ws`.
 * @returns {string} The decoded string payload.
 */
function rawDataToString(raw: RawData): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
  if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
  return raw.toString("utf8");
}

/**
 * Parses a raw Schwab websocket frame into individual top-level entries.
 * @param {RawData} raw Raw websocket payload from `ws`.
 * @returns {ParsedIncomingEntry[]} Parsed `notify`, `response`, and `data` entries.
 */
function parseIncomingFrame(raw: RawData): ParsedIncomingEntry[] {
  const frame = StreamerFrameSchema.parse(JSON.parse(rawDataToString(raw)));

  const parsed: ParsedIncomingEntry[] = [];

  for (const notify of frame.notify ?? []) {
    parsed.push({ type: "notify", payload: notify });
  }

  for (const response of frame.response ?? []) {
    parsed.push({
      type: "response",
      service: response.service,
      payload: response,
    });
  }

  for (const data of frame.data ?? []) {
    parsed.push({
      type: "data",
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

/**
 * Coordinates the Schwab websocket connection and republishes inbound frames over ZMQ.
 */
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
  private readonly subscriptionState = new Map<
    StreamService,
    SubscriptionBucket
  >();
  private expectedClose = false;

  /**
   * Creates a streamer instance with optional ZMQ publishing configuration.
   * @param {{ publisherAddress?: string; topicPrefix?: string; }} [options] Optional publisher address and topic prefix overrides.
   */
  constructor(
    options: { publisherAddress?: string; topicPrefix?: string } = {},
  ) {
    this.publisherAddress =
      options.publisherAddress ?? DEFAULT_PUBLISHER_ADDRESS;
    this.topicPrefix = options.topicPrefix ?? DEFAULT_TOPIC_PREFIX;
  }

  /**
   * Opens the Schwab websocket and binds the outbound ZMQ publisher.
   * @returns {Promise<void>} Resolves once the websocket connection has opened.
   */
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
        reject(this.toError(error, "Failed to connect to Schwab streamer"));
      };

      const cleanup = () => {
        ws.off("open", handleOpen);
        ws.off("error", handleError);
      };

      ws.once("open", handleOpen);
      ws.once("error", handleError);
    });
  }

  /**
   * Sends `ADMIN/LOGIN` and waits for the corresponding successful Schwab response.
   * @returns {Promise<void>} Resolves after the streamer is authenticated.
   */
  async login(): Promise<void> {
    return this.enqueueCommand(async () => {
      if (this.loggedIn) return;

      this.ensureConnected();
      const context = this.requireContext();
      const requestId = this.nextRequestId();

      await this.sendRequestAndAwaitResponse(
        buildLoginRequest(context, requestId),
        requestId,
      );
      this.loggedIn = true;
    });
  }

  /**
   * Sends `ADMIN/LOGOUT` and clears the local subscription state.
   * @returns {Promise<void>} Resolves after logout has been acknowledged or no active session remains.
   */
  async logout(): Promise<void> {
    return this.enqueueCommand(async () => {
      if (!this.connected || !this.ws || !this.loggedIn) {
        this.loggedIn = false;
        this.subscriptionState.clear();
        return;
      }

      const context = this.requireContext();
      const requestId = this.nextRequestId();

      this.expectedClose = true;

      try {
        await this.sendRequestAndAwaitResponse(
          buildLogoutRequest(context, requestId),
          requestId,
        );
      } catch (error) {
        this.expectedClose = false;
        throw error;
      }

      this.loggedIn = false;
      this.subscriptionState.clear();
    });
  }

  /**
   * Replaces the active subscription set for a service.
   * @param {SubscriptionInput} input Service, symbol keys, and fields to subscribe to.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the subscription request.
   */
  async subs(input: SubscriptionInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeSubscriptionInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, "SUBS", normalized),
        requestId,
      );

      this.subscriptionState.set(normalized.service, {
        keys: new Set(normalized.keys),
        fields: [...normalized.fields],
      });
    });
  }

  /**
   * Replaces the active `LEVELONE_EQUITIES` subscription set using semantic field names.
   * @param {LevelOneEquitiesSubscriptionInput} input Equity symbol keys and semantic fields to subscribe to.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the subscription request.
   */
  async subsL1Equities(
    input: LevelOneEquitiesSubscriptionInput,
  ): Promise<void> {
    return this.subs({
      service: "LEVELONE_EQUITIES",
      keys: input.keys,
      fields: resolveLevelOneEquitiesFieldNames(input.fields),
    });
  }

  /**
   * Replaces the active `LEVELONE_OPTIONS` subscription set using semantic field names.
   * @param {LevelOneOptionsSubscriptionInput} input Option symbol keys and semantic fields to subscribe to.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the subscription request.
   */
  async subsL1Options(input: LevelOneOptionsSubscriptionInput): Promise<void> {
    return this.subs({
      service: "LEVELONE_OPTIONS",
      keys: input.keys,
      fields: resolveLevelOneOptionsFieldNames(input.fields),
    });
  }

  /**
   * Replaces the active `LEVELONE_FUTURES` subscription set using semantic field names.
   * @param {LevelOneFuturesSubscriptionInput} input Futures symbol keys and semantic fields to subscribe to.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the subscription request.
   */
  async subsL1Futures(
    input: LevelOneFuturesSubscriptionInput,
  ): Promise<void> {
    return this.subs({
      service: "LEVELONE_FUTURES",
      keys: input.keys,
      fields: resolveLevelOneFuturesFieldNames(input.fields),
    });
  }

  async subsL1FuturesOptions(
    input: LevelOneFuturesOptionsSubscriptionInput,
  ): Promise<void> {
    return this.subs({
      service: "LEVELONE_FUTURES_OPTIONS",
      keys: input.keys,
      fields: resolveLevelOneFuturesOptionsFieldNames(input.fields),
    });
  }

  async subsL1Forex(input: LevelOneForexSubscriptionInput): Promise<void> {
    return this.subs({
      service: "LEVELONE_FOREX",
      keys: input.keys,
      fields: resolveLevelOneForexFieldNames(input.fields),
    });
  }

  async subsL2NyseBook(input: L2NyseBookSubscriptionInput): Promise<void> {
    return this.subs({
      service: "NYSE_BOOK",
      keys: input.keys,
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async subsL2NasdaqBook(input: L2NasdaqBookSubscriptionInput): Promise<void> {
    return this.subs({
      service: "NASDAQ_BOOK",
      keys: input.keys,
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async subsL2OptionsBook(input: L2OptionsBookSubscriptionInput): Promise<void> {
    return this.subs({
      service: "OPTIONS_BOOK",
      keys: input.keys,
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async subsChartEquity(input: ChartEquitySubscriptionInput): Promise<void> {
    return this.subs({
      service: "CHART_EQUITY",
      keys: input.keys,
      fields: resolveChartEquityFieldNames(input.fields),
    });
  }

  async subsChartFutures(input: ChartFuturesSubscriptionInput): Promise<void> {
    return this.subs({
      service: "CHART_FUTURES",
      keys: input.keys,
      fields: resolveChartFuturesFieldNames(input.fields),
    });
  }

  async subsScreenerEquity(
    input: ScreenerEquitySubscriptionInput,
  ): Promise<void> {
    return this.subs({
      service: "SCREENER_EQUITY",
      keys: input.keys,
      fields: resolveScreenerFieldNames(input.fields),
    });
  }

  async subsScreenerOption(
    input: ScreenerOptionSubscriptionInput,
  ): Promise<void> {
    return this.subs({
      service: "SCREENER_OPTION",
      keys: input.keys,
      fields: resolveScreenerFieldNames(input.fields),
    });
  }

  async subsAcctActivity(input: AcctActivitySubscriptionInput): Promise<void> {
    return this.subs({
      service: "ACCT_ACTIVITY",
      keys: input.keys,
      fields: resolveAcctActivityFieldNames(input.fields),
    });
  }

  /**
   * Adds symbol keys to an existing service subscription.
   * @param {SubscriptionInput} input Service, symbol keys, and fields to add.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the add request.
   */
  async add(input: SubscriptionInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeSubscriptionInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, "ADD", normalized),
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

  /**
   * Adds `LEVELONE_EQUITIES` symbol keys using semantic field names.
   * @param {LevelOneEquitiesSubscriptionInput} input Equity symbol keys and semantic fields to add.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the add request.
   */
  async addL1Equities(
    input: LevelOneEquitiesSubscriptionInput,
  ): Promise<void> {
    return this.add({
      service: "LEVELONE_EQUITIES",
      keys: input.keys,
      fields: resolveLevelOneEquitiesFieldNames(input.fields),
    });
  }

  /**
   * Adds `LEVELONE_OPTIONS` symbol keys using semantic field names.
   * @param {LevelOneOptionsSubscriptionInput} input Option symbol keys and semantic fields to add.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the add request.
   */
  async addL1Options(input: LevelOneOptionsSubscriptionInput): Promise<void> {
    return this.add({
      service: "LEVELONE_OPTIONS",
      keys: input.keys,
      fields: resolveLevelOneOptionsFieldNames(input.fields),
    });
  }

  /**
   * Adds `LEVELONE_FUTURES` symbol keys using semantic field names.
   * @param {LevelOneFuturesSubscriptionInput} input Futures symbol keys and semantic fields to add.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the add request.
   */
  async addL1Futures(
    input: LevelOneFuturesSubscriptionInput,
  ): Promise<void> {
    return this.add({
      service: "LEVELONE_FUTURES",
      keys: input.keys,
      fields: resolveLevelOneFuturesFieldNames(input.fields),
    });
  }

  async addL1FuturesOptions(
    input: LevelOneFuturesOptionsSubscriptionInput,
  ): Promise<void> {
    return this.add({
      service: "LEVELONE_FUTURES_OPTIONS",
      keys: input.keys,
      fields: resolveLevelOneFuturesOptionsFieldNames(input.fields),
    });
  }

  async addL1Forex(input: LevelOneForexSubscriptionInput): Promise<void> {
    return this.add({
      service: "LEVELONE_FOREX",
      keys: input.keys,
      fields: resolveLevelOneForexFieldNames(input.fields),
    });
  }

  async addL2NyseBook(input: L2NyseBookSubscriptionInput): Promise<void> {
    return this.add({
      service: "NYSE_BOOK",
      keys: input.keys,
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async addL2NasdaqBook(input: L2NasdaqBookSubscriptionInput): Promise<void> {
    return this.add({
      service: "NASDAQ_BOOK",
      keys: input.keys,
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async addL2OptionsBook(input: L2OptionsBookSubscriptionInput): Promise<void> {
    return this.add({
      service: "OPTIONS_BOOK",
      keys: input.keys,
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async addChartEquity(input: ChartEquitySubscriptionInput): Promise<void> {
    return this.add({
      service: "CHART_EQUITY",
      keys: input.keys,
      fields: resolveChartEquityFieldNames(input.fields),
    });
  }

  async addChartFutures(input: ChartFuturesSubscriptionInput): Promise<void> {
    return this.add({
      service: "CHART_FUTURES",
      keys: input.keys,
      fields: resolveChartFuturesFieldNames(input.fields),
    });
  }

  async addScreenerEquity(
    input: ScreenerEquitySubscriptionInput,
  ): Promise<void> {
    return this.add({
      service: "SCREENER_EQUITY",
      keys: input.keys,
      fields: resolveScreenerFieldNames(input.fields),
    });
  }

  async addScreenerOption(
    input: ScreenerOptionSubscriptionInput,
  ): Promise<void> {
    return this.add({
      service: "SCREENER_OPTION",
      keys: input.keys,
      fields: resolveScreenerFieldNames(input.fields),
    });
  }

  /**
   * Removes symbol keys from an existing service subscription.
   * @param {UnsubscribeInput} input Service and symbol keys to remove.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the unsubscribe request.
   */
  async unsubs(input: UnsubscribeInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeUnsubscribeInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, "UNSUBS", normalized),
        requestId,
      );

      const existing = this.subscriptionState.get(normalized.service);
      if (!existing) return;

      for (const key of normalized.keys ?? []) {
        existing.keys.delete(key);
      }
    });
  }

  /**
   * Updates the subscribed field list for a service without changing its current keys.
   * @param {ViewInput} input Service and field identifiers to apply.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the view request.
   */
  async view(input: ViewInput): Promise<void> {
    return this.enqueueCommand(async () => {
      this.ensureLoggedIn();

      const normalized = this.normalizeViewInput(input);
      const requestId = this.nextRequestId();
      const context = this.requireContext();

      await this.sendRequestAndAwaitResponse(
        buildServiceRequest(context, requestId, "VIEW", normalized),
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

  /**
   * Updates the `LEVELONE_EQUITIES` field list using semantic field names.
   * @param {LevelOneEquitiesViewInput} input Semantic equity fields to apply.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the view request.
   */
  async viewL1Equities(input: LevelOneEquitiesViewInput): Promise<void> {
    return this.view({
      service: "LEVELONE_EQUITIES",
      fields: resolveLevelOneEquitiesFieldNames(input.fields),
    });
  }

  /**
   * Updates the `LEVELONE_OPTIONS` field list using semantic field names.
   * @param {LevelOneOptionsViewInput} input Semantic option fields to apply.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the view request.
   */
  async viewL1Options(input: LevelOneOptionsViewInput): Promise<void> {
    return this.view({
      service: "LEVELONE_OPTIONS",
      fields: resolveLevelOneOptionsFieldNames(input.fields),
    });
  }

  /**
   * Updates the `LEVELONE_FUTURES` field list using semantic field names.
   * @param {LevelOneFuturesViewInput} input Semantic futures fields to apply.
   * @returns {Promise<void>} Resolves after Schwab acknowledges the view request.
   */
  async viewL1Futures(input: LevelOneFuturesViewInput): Promise<void> {
    return this.view({
      service: "LEVELONE_FUTURES",
      fields: resolveLevelOneFuturesFieldNames(input.fields),
    });
  }

  async viewL1FuturesOptions(
    input: LevelOneFuturesOptionsViewInput,
  ): Promise<void> {
    return this.view({
      service: "LEVELONE_FUTURES_OPTIONS",
      fields: resolveLevelOneFuturesOptionsFieldNames(input.fields),
    });
  }

  async viewL1Forex(input: LevelOneForexViewInput): Promise<void> {
    return this.view({
      service: "LEVELONE_FOREX",
      fields: resolveLevelOneForexFieldNames(input.fields),
    });
  }

  async viewL2NyseBook(input: L2NyseBookViewInput): Promise<void> {
    return this.view({
      service: "NYSE_BOOK",
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async viewL2NasdaqBook(input: L2NasdaqBookViewInput): Promise<void> {
    return this.view({
      service: "NASDAQ_BOOK",
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async viewL2OptionsBook(input: L2OptionsBookViewInput): Promise<void> {
    return this.view({
      service: "OPTIONS_BOOK",
      fields: resolveBookFieldNames(input.fields),
    });
  }

  async viewChartEquity(input: ChartEquityViewInput): Promise<void> {
    return this.view({
      service: "CHART_EQUITY",
      fields: resolveChartEquityFieldNames(input.fields),
    });
  }

  async viewChartFutures(input: ChartFuturesViewInput): Promise<void> {
    return this.view({
      service: "CHART_FUTURES",
      fields: resolveChartFuturesFieldNames(input.fields),
    });
  }

  async viewScreenerEquity(input: ScreenerEquityViewInput): Promise<void> {
    return this.view({
      service: "SCREENER_EQUITY",
      fields: resolveScreenerFieldNames(input.fields),
    });
  }

  async viewScreenerOption(input: ScreenerOptionViewInput): Promise<void> {
    return this.view({
      service: "SCREENER_OPTION",
      fields: resolveScreenerFieldNames(input.fields),
    });
  }

  /**
   * Returns the locally tracked subscription state by service.
   * @returns {Record<string, SubscriptionState>} Subscription keys and fields known to this instance.
   */
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

  /**
   * Closes the websocket and ZMQ publisher, rejecting any currently pending requests.
   * @returns {Promise<void>} Resolves after local resources have been cleaned up.
   */
  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;
    this.expectedClose = true;
    this.connected = false;
    this.loggedIn = false;
    this.subscriptionState.clear();
    this.rejectPendingRequests(new Error("Streamer closed"));

    const ws = this.ws;
    this.ws = null;

    if (ws && ws.readyState !== WebSocket.CLOSED) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (typeof ws.terminate === "function" && ws.readyState !== WebSocket.CLOSED) {
            ws.terminate();
          }

          resolve();
        }, CLOSE_TIMEOUT_MS);

        ws.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.close();
      });
    }

    this.handleSocketClose(ws);

    if (this.publisher) {
      this.publisher.linger = 0;
      await this.publisher.close();
      this.publisher = null;
    }
  }

  /**
   * Ensures the streamer has not already been closed.
   * @returns {void}
   */
  private ensureNotClosed(): void {
    if (this.closed) {
      throw new Error("Streamer is closed");
    }
  }

  /**
   * Ensures the websocket connection is currently open.
   * @returns {void}
   */
  private ensureConnected(): void {
    this.ensureNotClosed();

    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Streamer is not connected");
    }
  }

  /**
   * Ensures the streamer is both connected and logged in before service commands are sent.
   * @returns {void}
   */
  private ensureLoggedIn(): void {
    this.ensureConnected();

    if (!this.loggedIn) {
      throw new Error(
        "Streamer must be logged in before sending service commands",
      );
    }
  }

  /**
   * Returns the loaded streamer context or throws if it has not been initialized.
   * @returns {StreamerContext} The active streamer context.
   */
  private requireContext(): StreamerContext {
    if (!this.context) {
      throw new Error("Streamer context has not been loaded");
    }

    return this.context;
  }

  /**
   * Produces the next monotonic request id for this streamer instance.
   * @returns {string} The next request identifier.
   */
  private nextRequestId(): string {
    this.requestCounter += 1;
    return `${this.requestCounter}`;
  }

  /**
   * Serializes command execution so Schwab commands do not overlap.
   * @template T
   * @param {() => Promise<T>} operation Async command operation to enqueue.
   * @returns {Promise<T>} The result of the queued operation.
   */
  private enqueueCommand<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.commandChain.then(operation);
    this.commandChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * Sends a websocket request and waits for the matching Schwab response frame.
   * @param {StreamerRequestEnvelope} payload Request envelope to send over the websocket.
   * @param {string} requestId Request id used to match the response.
   * @returns {Promise<StreamerResponse>} The matching Schwab response.
   */
  private async sendRequestAndAwaitResponse(
    payload: StreamerRequestEnvelope,
    requestId: string,
  ): Promise<StreamerResponse> {
    this.ensureConnected();
    const ws = this.ws!;

    return new Promise<StreamerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new Error(`Timed out waiting for response to request ${requestId}`),
        );
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

  /**
   * Installs websocket event handlers for inbound frames, close events, and socket errors.
   * @param {WebSocket} ws Active websocket instance.
   * @returns {void}
   */
  private installSocketHandlers(ws: WebSocket): void {
    ws.on("message", (raw) => {
      void this.handleIncomingFrame(raw).catch((error) => {
        this.rejectPendingRequests(
          this.toError(error, "Failed to handle inbound streamer frame"),
        );
      });
    });

    ws.on("close", () => {
      if (this.expectedClose) {
        this.handleSocketClose(ws);
        return;
      }

      this.handleSocketTermination(
        ws,
        new Error("Schwab streamer websocket closed"),
      );
    });

    ws.on("error", (error) => {
      this.handleSocketTermination(
        ws,
        this.toError(error, "Schwab streamer websocket error"),
      );
    });
  }

  /**
   * Parses a websocket frame, republishes it to ZMQ, and resolves any matching pending response.
   * @param {RawData} raw Raw websocket payload.
   * @returns {Promise<void>} Resolves after all frame entries have been processed.
   */
  private async handleIncomingFrame(raw: RawData): Promise<void> {
    const receivedAt = Date.now();
    const entries = parseIncomingFrame(raw);

    for (const entry of entries) {
      await this.publishEntry(entry, receivedAt);

      if (entry.type !== "response") continue;

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

  /**
   * Publishes a parsed Schwab entry to the configured ZMQ publisher.
   * @param {ParsedIncomingEntry} entry Parsed websocket entry to publish.
   * @param {number} receivedAt Millisecond timestamp recorded when the frame was received.
   * @returns {Promise<void>} Resolves after the message has been sent to ZMQ.
   */
  private async publishEntry(
    entry: ParsedIncomingEntry,
    receivedAt: number,
  ): Promise<void> {
    if (!this.publisher) return;

    const message: PublishedMessage = {
      type: entry.type,
      receivedAt,
      payload: entry.payload,
    };

    await publish(this.publisher, this.topicFor(entry), adapter(message));
  }

  /**
   * Maps a parsed Schwab entry to its outbound ZMQ topic.
   * @param {ParsedIncomingEntry} entry Parsed websocket entry.
   * @returns {string} Topic name used when publishing the entry.
   */
  private topicFor(entry: ParsedIncomingEntry): string {
    if (entry.type === "notify") {
      return `${this.topicPrefix}.notify`;
    }

    return `${this.topicPrefix}.${entry.type}.${entry.service}`;
  }

  /**
   * Finalizes state for an expected websocket close without rejecting pending work.
   * @param {WebSocket | null} ws Websocket instance being closed.
   * @returns {void}
   */
  private handleSocketClose(ws: WebSocket | null): void {
    if (ws && this.ws === ws) {
      this.ws = null;
    }

    this.connected = false;
    this.loggedIn = false;
    this.expectedClose = false;
  }

  /**
   * Handles an unexpected websocket termination and rejects any pending requests.
   * @param {WebSocket} ws Websocket instance that terminated.
   * @param {Error} error Error used to reject pending requests.
   * @returns {void}
   */
  private handleSocketTermination(ws: WebSocket, error: Error): void {
    if (this.ws === ws) {
      this.ws = null;
    }

    this.connected = false;
    this.loggedIn = false;
    this.expectedClose = false;
    this.rejectPendingRequests(error);
  }

  /**
   * Rejects and clears all pending request promises.
   * @param {Error} error Error used to reject each pending request.
   * @returns {void}
   */
  private rejectPendingRequests(error: Error): void {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Validates and normalizes subscription input for `SUBS` and `ADD`.
   * @param {SubscriptionInput} input Raw subscription input.
   * @returns {ServiceRequestParams & { keys: string[]; fields: string[]; }} Normalized subscription payload.
   */
  private normalizeSubscriptionInput(
    input: SubscriptionInput,
  ): ServiceRequestParams & {
    keys: string[];
    fields: string[];
  } {
    const keys = normalizeKeys(input.keys);
    const fields = normalizeFields(input.fields);

    if (keys.length === 0) {
      throw new Error("Subscription requires at least one symbol key");
    }

    if (fields.length === 0) {
      throw new Error("Subscription requires at least one field");
    }

    return {
      service: input.service,
      keys,
      fields,
    };
  }

  /**
   * Validates and normalizes unsubscribe input for `UNSUBS`.
   * @param {UnsubscribeInput} input Raw unsubscribe input.
   * @returns {ServiceRequestParams & { keys: string[]; }} Normalized unsubscribe payload.
   */
  private normalizeUnsubscribeInput(
    input: UnsubscribeInput,
  ): ServiceRequestParams & { keys: string[] } {
    const keys = normalizeKeys(input.keys);

    if (keys.length === 0) {
      throw new Error("Unsubscribe requires at least one symbol key");
    }

    return {
      service: input.service,
      keys,
    };
  }

  /**
   * Validates and normalizes view input for `VIEW`.
   * @param {ViewInput} input Raw view input.
   * @returns {ServiceRequestParams & { fields: string[]; }} Normalized view payload.
   */
  private normalizeViewInput(
    input: ViewInput,
  ): ServiceRequestParams & { fields: string[] } {
    const fields = normalizeFields(input.fields);

    if (fields.length === 0) {
      throw new Error("View requires at least one field");
    }

    return {
      service: input.service,
      fields,
    };
  }

  /**
   * Normalizes unknown thrown values into `Error` instances.
   * @param {unknown} error Value that may or may not already be an `Error`.
   * @param {string} fallbackMessage Message to use when coercing a non-Error value.
   * @returns {Error} The original error or a new `Error` with the fallback message.
   */
  private toError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error) return error;
    return new Error(fallbackMessage);
  }
}
