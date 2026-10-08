export type BrowserTarget = "chrome" | "firefox";

export interface BrowserConfig {
  target: BrowserTarget;
  nativeHostName: string;
  // Single-byte browser code the Go installer expects after --install=.
  browserByte: "C" | "F";
  checksIncognitoAccess: boolean;
}

export function getBrowserConfig(target: BrowserTarget): BrowserConfig {
  if (target === "firefox") {
    return {
      target,
      nativeHostName: "com.tailscale.browserext.firefox",
      browserByte: "F",
      checksIncognitoAccess: true,
    };
  }
  return {
    target,
    nativeHostName: "com.tailscale.browserext.chrome",
    browserByte: "C",
    checksIncognitoAccess: false,
  };
}

export function buildInstallCommand(config: BrowserConfig, extensionId: string): string {
  return `go run github.com/tailscale/ts-browser-ext@main --install=${config.browserByte}${extensionId}`;
}

export function currentBrowserTarget(): BrowserTarget {
  return import.meta.env.BROWSER === "firefox" ? "firefox" : "chrome";
}
