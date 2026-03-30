import { describe, expect, test } from "vitest";
import { resolveSchwabPaths } from "../src/oauth/paths.js";

describe("resolveSchwabPaths", () => {
  test("builds default env and storage paths from cwd", () => {
    const paths = resolveSchwabPaths({
      cwd: "/tmp/schwab-node-project",
    });

    expect(paths.cwd).toBe("/tmp/schwab-node-project");
    expect(paths.envPath).toBe("/tmp/schwab-node-project/.env");
    expect(paths.storageRoot).toBe("/tmp/schwab-node-project/.secrets");
    expect(paths.tokenPath).toBe("/tmp/schwab-node-project/.secrets/token");
    expect(paths.certsDir).toBe("/tmp/schwab-node-project/.secrets/certs");
    expect(paths.callbackUrlPath).toBe(
      "/tmp/schwab-node-project/.secrets/callback-url",
    );
  });

  test("supports relative and absolute overrides", () => {
    const paths = resolveSchwabPaths({
      cwd: "/tmp/schwab-node-project",
      envPath: "config/schwab.env",
      storageRoot: "/var/lib/schwab-node",
    });

    expect(paths.envPath).toBe("/tmp/schwab-node-project/config/schwab.env");
    expect(paths.storageRoot).toBe("/var/lib/schwab-node");
    expect(paths.tokenPath).toBe("/var/lib/schwab-node/token");
    expect(paths.certsDir).toBe("/var/lib/schwab-node/certs");
    expect(paths.callbackUrlPath).toBe("/var/lib/schwab-node/callback-url");
  });
});
