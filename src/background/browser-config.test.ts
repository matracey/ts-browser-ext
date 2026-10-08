import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInstallCommand, currentBrowserTarget, getBrowserConfig } from "./browser-config";

describe("getBrowserConfig", () => {
  it("returns Chrome settings", () => {
    expect(getBrowserConfig("chrome")).toEqual({
      target: "chrome",
      nativeHostName: "com.tailscale.browserext.chrome",
      browserByte: "C",
      checksIncognitoAccess: false,
    });
  });

  it("returns Firefox settings", () => {
    expect(getBrowserConfig("firefox")).toEqual({
      target: "firefox",
      nativeHostName: "com.tailscale.browserext.firefox",
      browserByte: "F",
      checksIncognitoAccess: true,
    });
  });
});

describe("buildInstallCommand", () => {
  it.each([
    ["chrome", "go run github.com/tailscale/ts-browser-ext@main --install=Cabc"],
    ["firefox", "go run github.com/tailscale/ts-browser-ext@main --install=Fabc"],
  ] as const)("builds the %s command", (target, expected) => {
    expect(buildInstallCommand(getBrowserConfig(target), "abc")).toBe(expected);
  });
});

describe("currentBrowserTarget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["firefox", "firefox"],
    ["chrome", "chrome"],
    ["edge", "chrome"],
  ])("maps BROWSER=%s to %s", (browser, expected) => {
    vi.stubEnv("BROWSER", browser);
    expect(currentBrowserTarget()).toBe(expected);
  });
});
