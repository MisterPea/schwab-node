import { constructMarketDataUrl } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import { type GetMoversConfig, GetMoversSchema, type MoversConfig, type ScreenersResponse, ScreenersResponseSchema } from "./schema.js";

/**
 * Returns a list of top 10 securities movement for a specific index.
 */
export async function getMovers(config: GetMoversConfig): Promise<ScreenersResponse> {
  const parsedConfig = GetMoversSchema.parse(config);
  const { index, sort } = parsedConfig;
  const moversConfig: MoversConfig = {
    sort,
    frequency: parsedConfig.frequency ?? 0,
  };

  const url = constructMarketDataUrl(moversConfig, `/movers/${encodeURIComponent(index)}`);
  const res = await getRequest(url);
  const json = await res.json();
  const screeners = json.screeners ?? [];
  return ScreenersResponseSchema.parse(screeners);
}
