import { warnLegacyImportRoute } from "../legacy/warn.js";

warnLegacyImportRoute(
  "@misterpea/schwab-node/marketData/request",
  "@misterpea/schwab-node/scripts/request",
);

export { createGetRequest, getRequest } from "../request/index.js";
