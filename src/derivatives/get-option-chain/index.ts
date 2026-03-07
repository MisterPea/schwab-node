import * as z from "zod";
import { constructMarketDataUrl } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import {
  type GetOptionChainReturn,
  GetOptionChainReturnSchema,
  type GetOptionChainRequest,
  GetOptionChainRequestSchema,
} from "./schema.js";

export async function getOptionChain(
  config: GetOptionChainRequest,
): Promise<GetOptionChainReturn | undefined> {
  const result = GetOptionChainRequestSchema.safeParse(config);

  if (!result.success) {
    console.error(JSON.stringify(z.treeifyError(result.error), undefined, 1));
    return;
  }

  const url = constructMarketDataUrl(config, "/chains");
  const res = await getRequest(url);
  const json = await res.json();
  return GetOptionChainReturnSchema.parse(json);
}
