import { browser } from "wxt/browser";
import { PROXY_BYPASS_LIST, PROXY_HOST, type ProxyAdapter } from "./types";

export interface ChromiumProxyDetails {
  value:
    | { mode: "direct" }
    | {
        mode: "fixed_servers";
        rules: {
          singleProxy: { scheme: "http"; host: string; port: number };
          bypassList: string[];
        };
      };
  scope: "regular";
}

export interface ChromiumProxySettingsLike {
  set(details: ChromiumProxyDetails): Promise<void>;
}

// Resolved lazily so importing this module never touches extension APIs.
function defaultSettings(): ChromiumProxySettingsLike {
  return {
    async set(details) {
      await browser.proxy.settings.set(details);
    },
  };
}

export function createChromiumProxyAdapter(
  settings?: ChromiumProxySettingsLike,
): ProxyAdapter {
  const resolve = () => (settings ??= defaultSettings());

  return {
    async enable(port) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new RangeError(`Invalid proxy port: ${port}`);
      }
      await resolve().set({
        value: {
          mode: "fixed_servers",
          rules: {
            singleProxy: { scheme: "http", host: PROXY_HOST, port },
            bypassList: [...PROXY_BYPASS_LIST],
          },
        },
        scope: "regular",
      });
    },
    async disable() {
      await resolve().set({ value: { mode: "direct" }, scope: "regular" });
    },
  };
}
