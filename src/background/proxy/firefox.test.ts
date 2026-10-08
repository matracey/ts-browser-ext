import { describe, expect, it, vi } from "vitest";
import {
  createFirefoxProxyAdapter,
  type FirefoxProxyApiLike,
  type FirefoxProxyListener,
} from "./firefox";

function makeApi() {
  const listeners = new Set<FirefoxProxyListener>();
  const api = {
    onRequest: {
      addListener: vi.fn((l: FirefoxProxyListener) => void listeners.add(l)),
      removeListener: vi.fn((l: FirefoxProxyListener) =>
        void listeners.delete(l),
      ),
    },
    settings: { set: vi.fn(async () => undefined) },
  } satisfies FirefoxProxyApiLike;
  return { api, listeners };
}

describe("createFirefoxProxyAdapter", () => {
  it("registers a listener for all urls", async () => {
    const { api } = makeApi();
    await createFirefoxProxyAdapter(api).enable(1234);
    expect(api.onRequest.addListener).toHaveBeenCalledWith(
      expect.any(Function),
      { urls: ["<all_urls>"] },
    );
  });

  it("uses http for the Tailscale web host and socks otherwise", async () => {
    const { api, listeners } = makeApi();
    await createFirefoxProxyAdapter(api).enable(1234);
    const [listener] = [...listeners];
    expect(listener!({ url: "http://100.100.100.100/" })).toEqual({
      type: "http",
      host: "127.0.0.1",
      port: 1234,
    });
    expect(listener!({ url: "https://example.com/x" })).toEqual({
      type: "socks",
      host: "127.0.0.1",
      port: 1234,
      proxyDNS: true,
    });
  });

  it("sends loopback hosts direct", async () => {
    const { api, listeners } = makeApi();
    await createFirefoxProxyAdapter(api).enable(1234);
    const [listener] = [...listeners];
    expect(listener!({ url: "http://localhost:3000/" })).toEqual({
      type: "direct",
    });
    expect(listener!({ url: "http://127.0.0.1:8080/" })).toEqual({
      type: "direct",
    });
    expect(listener!({ url: "http://localhost.example.com/" })).toMatchObject({
      type: "socks",
    });
  });

  it("replaces the previous listener when enabled again", async () => {
    const { api, listeners } = makeApi();
    const adapter = createFirefoxProxyAdapter(api);
    await adapter.enable(1000);
    const first = [...listeners][0]!;
    await adapter.enable(2000);
    expect(api.onRequest.removeListener).toHaveBeenCalledWith(first);
    expect(listeners.size).toBe(1);
    expect([...listeners][0]!({ url: "https://a.test/" })).toMatchObject({
      port: 2000,
    });
  });

  it("removes the exact registered listener and goes direct on disable", async () => {
    const { api, listeners } = makeApi();
    const adapter = createFirefoxProxyAdapter(api);
    await adapter.enable(1234);
    const registered = [...listeners][0]!;
    await adapter.disable();
    expect(api.onRequest.removeListener).toHaveBeenCalledWith(registered);
    expect(listeners.size).toBe(0);
    expect(api.settings.set).toHaveBeenCalledWith({
      value: { proxyType: "none" },
    });
  });

  it("disable without enable only resets settings", async () => {
    const { api } = makeApi();
    await createFirefoxProxyAdapter(api).disable();
    expect(api.onRequest.removeListener).not.toHaveBeenCalled();
    expect(api.settings.set).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 65536, 1.5, Number.NaN])("rejects port %s", async (port) => {
    const { api } = makeApi();
    await expect(createFirefoxProxyAdapter(api).enable(port)).rejects.toThrow(
      RangeError,
    );
    expect(api.onRequest.addListener).not.toHaveBeenCalled();
  });

  it("accepts boundary ports", async () => {
    const { api } = makeApi();
    const adapter = createFirefoxProxyAdapter(api);
    await adapter.enable(1);
    await adapter.enable(65535);
    expect(api.onRequest.addListener).toHaveBeenCalledTimes(2);
  });

  it("falls back to browser.proxy lazily", async () => {
    const { api } = makeApi();
    const { browser } = await import("wxt/browser");
    const target = browser as unknown as { proxy?: FirefoxProxyApiLike };
    const original = target.proxy;
    target.proxy = api;
    try {
      const adapter = createFirefoxProxyAdapter();
      await adapter.enable(4321);
      await adapter.disable();
      expect(api.onRequest.addListener).toHaveBeenCalledTimes(1);
      expect(api.settings.set).toHaveBeenCalledTimes(1);
    } finally {
      target.proxy = original;
    }
  });
});
