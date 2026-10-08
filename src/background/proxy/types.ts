// A proxy adapter routes browser traffic through the local tsnet proxy.
// Chromium and Firefox need different implementations.
export interface ProxyAdapter {
  // enable routes traffic through 127.0.0.1:port. Calling it again with a
  // new port replaces the previous configuration.
  enable(port: number): Promise<void>;
  // disable restores direct connections and removes any listeners.
  disable(): Promise<void>;
}

export const PROXY_HOST = "127.0.0.1";
export const PROXY_BYPASS_LIST = ["localhost", "127.*"];
// Tailscale's local web interface must be reached over HTTP, not SOCKS.
export const TAILSCALE_WEB_HOST = "100.100.100.100";
