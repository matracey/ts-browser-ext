import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { createChromiumProxyAdapter } from "./chromium";

describe("createChromiumProxyAdapter", () => {
  const set = vi.fn(async () => {});

  beforeEach(() => {
    fakeBrowser.reset();
    set.mockClear();
  });

  it("enables a fixed http proxy with the bypass list", async () => {
    await createChromiumProxyAdapter({ set }).enable(8080);
    expect(set).toHaveBeenCalledWith({
      value: {
        mode: "fixed_servers",
        rules: {
          singleProxy: { scheme: "http", host: "127.0.0.1", port: 8080 },
          bypassList: ["localhost", "127.*"],
        },
      },
      scope: "regular",
    });
  });

  it("disables by switching to direct mode", async () => {
    await createChromiumProxyAdapter({ set }).disable();
    expect(set).toHaveBeenCalledWith({
      value: { mode: "direct" },
      scope: "regular",
    });
  });

  it.each([0, -1, 65536, 1.5, Number.NaN])("rejects port %s", async (port) => {
    await expect(createChromiumProxyAdapter({ set }).enable(port)).rejects.toThrow(
      RangeError,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("accepts boundary ports", async () => {
    const adapter = createChromiumProxyAdapter({ set });
    await adapter.enable(1);
    await adapter.enable(65535);
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("defaults to browser.proxy.settings", async () => {
    const chromeSet = vi.fn(async () => {});
    (fakeBrowser as unknown as { proxy: unknown }).proxy = {
      settings: { set: chromeSet },
    };
    const adapter = createChromiumProxyAdapter();
    await adapter.enable(9000);
    await adapter.disable();
    expect(chromeSet).toHaveBeenCalledTimes(2);
  });
});
