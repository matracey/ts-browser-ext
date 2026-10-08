import { describe, expect, it, vi } from "vitest";
import { getBrowserConfig } from "./browser-config";
import { PopupBridge, type PopupPortLike } from "./popup-bridge";

function setup(target: "chrome" | "firefox", snap = { deadPort: false, proxyEnabled: false, lastStatus: {} as object }, allowed = true) {
  let changeCb: () => void = () => {};
  const session = {
    snapshot: vi.fn(() => snap),
    onChange: vi.fn((cb: () => void) => void (changeCb = cb)),
    refreshIcon: vi.fn(),
  };
  const isAllowedIncognitoAccess = vi.fn().mockResolvedValue(allowed);
  const bridge = new PopupBridge({
    config: getBrowserConfig(target),
    session: session as never,
    extensionId: "ext",
    isAllowedIncognitoAccess,
  });
  let disc: () => void = () => {};
  const port: PopupPortLike = {
    name: "popup",
    postMessage: vi.fn(),
    onDisconnect: { addListener: (cb) => void (disc = cb) },
  };
  return { bridge, session, port, isAllowedIncognitoAccess, disc: () => disc(), change: () => changeCb() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("PopupBridge", () => {
  it("ignores non-popup ports", async () => {
    const t = setup("chrome");
    t.bridge.handleConnect({ ...t.port, name: "other" });
    await flush();
    expect(t.bridge.connected).toBe(false);
    expect(t.port.postMessage).not.toHaveBeenCalled();
  });

  it("sends status on connect and clears on disconnect", async () => {
    const t = setup("chrome", { deadPort: false, proxyEnabled: true, lastStatus: { running: true } });
    t.bridge.handleConnect(t.port);
    await flush();
    expect(t.bridge.connected).toBe(true);
    expect(t.port.postMessage).toHaveBeenCalledWith({ status: { running: true } });
    expect(t.session.refreshIcon).toHaveBeenCalled();
    expect(t.isAllowedIncognitoAccess).not.toHaveBeenCalled();
    t.disc();
    expect(t.bridge.connected).toBe(false);
  });

  it("sends the install command when the native host is dead", async () => {
    const t = setup("chrome", { deadPort: true, proxyEnabled: false, lastStatus: {} });
    t.bridge.handleConnect(t.port);
    await flush();
    expect(t.port.postMessage).toHaveBeenCalledWith({
      installCmd: "go run github.com/tailscale/ts-browser-ext@main --install=Cext",
    });
  });

  it("asks Firefox users for incognito permission", async () => {
    const t = setup("firefox", undefined, false);
    t.bridge.handleConnect(t.port);
    await flush();
    expect(t.port.postMessage).toHaveBeenCalledWith({ needsIncognitoPermission: true });
    expect(t.port.postMessage).toHaveBeenCalledWith({ status: {} });
  });

  it("does not warn when Firefox has incognito access", async () => {
    const t = setup("firefox");
    t.bridge.handleConnect(t.port);
    await flush();
    expect(t.port.postMessage).not.toHaveBeenCalledWith({ needsIncognitoPermission: true });
  });

  it("pushes updates when the session changes and ignores stale disconnects", async () => {
    const t = setup("chrome");
    t.bridge.handleConnect(t.port);
    await flush();
    vi.mocked(t.port.postMessage).mockClear();
    t.change();
    await flush();
    expect(t.port.postMessage).toHaveBeenCalledOnce();
    const other = { ...t.port, onDisconnect: { addListener: vi.fn() } };
    t.bridge.handleConnect(other);
    t.disc();
    expect(t.bridge.connected).toBe(true);
  });

  it("does nothing when no popup is connected", async () => {
    const t = setup("chrome");
    await t.bridge.sendStatus();
    expect(t.port.postMessage).not.toHaveBeenCalled();
  });
});
