import { browser } from "wxt/browser";
import {
  PROXY_BYPASS_LIST,
  PROXY_HOST,
  TAILSCALE_WEB_HOST,
  type ProxyAdapter,
} from "./types";

export type FirefoxProxyInfo =
  | { type: "direct" }
  | { type: "http"; host: string; port: number }
  | { type: "socks"; host: string; port: number; proxyDNS: boolean };

export type FirefoxProxyListener = (details: {
  url: string;
}) => FirefoxProxyInfo;

export interface FirefoxProxyApiLike {
  onRequest: {
    addListener(
      listener: FirefoxProxyListener,
      filter: { urls: string[] },
    ): void;
    removeListener(listener: FirefoxProxyListener): void;
  };
  settings: {
    set(details: { value: { proxyType: "none" } }): Promise<unknown> | unknown;
  };
}

function isBypassed(host: string): boolean {
  return PROXY_BYPASS_LIST.some((pattern) =>
    pattern.endsWith("*")
      ? host.startsWith(pattern.slice(0, -1))
      : host === pattern,
  );
}

// Resolved lazily so importing this module never touches extension APIs.
function defaultApi(): FirefoxProxyApiLike {
  return (browser as unknown as { proxy: FirefoxProxyApiLike }).proxy;
}

export function createFirefoxProxyAdapter(
  api?: FirefoxProxyApiLike,
): ProxyAdapter {
  let listener: FirefoxProxyListener | null = null;

  const removeListener = (proxy: FirefoxProxyApiLike) => {
    if (listener) {
      proxy.onRequest.removeListener(listener);
      listener = null;
    }
  };

  return {
    async enable(port) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new RangeError(`Invalid proxy port: ${port}`);
      }
      const proxy = api ?? defaultApi();
      removeListener(proxy);
      // Firefox only lets SOCKS proxies resolve DNS; the Tailscale web
      // interface needs plain HTTP. Firefox ignores bypassList in onRequest
      // results, so loopback bypass is applied here instead.
      listener = (details) => {
        const host = new URL(details.url).hostname;
        if (isBypassed(host)) return { type: "direct" };
        return host === TAILSCALE_WEB_HOST
          ? { type: "http", host: PROXY_HOST, port }
          : { type: "socks", host: PROXY_HOST, port, proxyDNS: true };
      };
      proxy.onRequest.addListener(listener, { urls: ["<all_urls>"] });
    },

    async disable() {
      const proxy = api ?? defaultApi();
      removeListener(proxy);
      await proxy.settings.set({ value: { proxyType: "none" } });
    },
  };
}
