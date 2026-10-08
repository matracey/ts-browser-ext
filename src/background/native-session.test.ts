import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBrowserConfig } from "./browser-config";
import { NativeSession, type PortLike } from "./native-session";

function makePort() {
  let onMsg: (m: unknown) => void = () => {};
  let onDisc: () => void = () => {};
  const port: PortLike = {
    postMessage: vi.fn(),
    onMessage: { addListener: (cb) => void (onMsg = cb) },
    onDisconnect: { addListener: (cb) => void (onDisc = cb) },
  };
  return { port, msg: (m: unknown) => onMsg(m), disc: () => onDisc() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { profileId?: string } = {}) {
  const ports: ReturnType<typeof makePort>[] = [];
  let lastError: { message?: string } | undefined;
  const timers: Array<() => void> = [];
  const deps = {
    config: getBrowserConfig("chrome"),
    proxy: { enable: vi.fn().mockResolvedValue(undefined), disable: vi.fn().mockResolvedValue(undefined) },
    connectNative: vi.fn(() => {
      const p = makePort();
      ports.push(p);
      return p.port;
    }),
    getProfileId: vi.fn().mockResolvedValue(opts.profileId),
    setProfileId: vi.fn().mockResolvedValue(undefined),
    randomUUID: vi.fn(() => "new-uuid"),
    setIcon: vi.fn(),
    setTimeout: vi.fn((fn: () => void) => void timers.push(fn)),
    getLastError: vi.fn(() => lastError),
    logger: { log: vi.fn(), error: vi.fn() },
  };
  const session = new NativeSession(deps);
  return {
    session,
    deps,
    ports,
    timers,
    setLastError: (e: { message?: string } | undefined) => (lastError = e),
  };
}

describe("NativeSession", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup({ profileId: "pid" });
  });

  it("connects to the configured host and starts dead", async () => {
    t.session.start();
    await flush();
    expect(t.deps.connectNative).toHaveBeenCalledWith("com.tailscale.browserext.chrome");
    expect(t.session.isDead).toBe(true);
    expect(t.session.snapshot()).toEqual({ deadPort: true, proxyEnabled: false, lastStatus: {} });
  });

  it("sends init once after first message and profile load", async () => {
    t.session.start();
    await flush();
    t.ports[0]!.msg({});
    await flush();
    t.ports[0]!.msg({});
    await flush();
    const inits = vi.mocked(t.ports[0]!.port.postMessage).mock.calls.filter(([m]) => (m as { cmd: string }).cmd === "init");
    expect(inits).toEqual([[{ cmd: "init", initID: "pid" }]]);
    expect(t.session.initSent).toBe(true);
    expect(t.deps.setIcon).toHaveBeenLastCalledWith("offline");
  });

  it("generates and stores a profile id when missing", async () => {
    const m = setup();
    m.session.start();
    await flush();
    expect(m.deps.setProfileId).toHaveBeenCalledWith("new-uuid");
    m.ports[0]!.msg({ status: { running: true } });
    await flush();
    expect(m.ports[0]!.port.postMessage).toHaveBeenCalledWith({ cmd: "init", initID: "new-uuid" });
    expect(m.session.status).toEqual({ running: true });
  });

  it("ignores non-object messages", async () => {
    t.session.start();
    await flush();
    t.ports[0]!.msg("junk");
    await flush();
    expect(t.session.isDead).toBe(true);
  });

  it("enables the proxy on procRunning.port", async () => {
    t.session.start();
    await flush();
    t.ports[0]!.msg({ procRunning: { port: 1234, pid: 1, error: "" } });
    await flush();
    expect(t.deps.proxy.enable).toHaveBeenCalledWith(1234);
    expect(t.session.isProxyEnabled).toBe(true);
    expect(t.session.proxyPort).toBe(1234);
    expect(t.deps.setIcon).toHaveBeenLastCalledWith("online");
  });

  it("logs when enabling the proxy fails", async () => {
    t.deps.proxy.enable.mockRejectedValueOnce(new Error("x"));
    t.session.start();
    await flush();
    t.ports[0]!.msg({ procRunning: { port: 1, pid: 1, error: "" } });
    await flush();
    expect(t.deps.logger.error).toHaveBeenCalled();
  });

  it("disables the proxy on procRunning.error", async () => {
    t.session.start();
    await flush();
    t.ports[0]!.msg({ procRunning: { port: 0, pid: 0, error: "boom" } });
    await flush();
    expect(t.deps.proxy.disable).toHaveBeenCalledOnce();
    expect(t.ports[0]!.port.postMessage).toHaveBeenCalledWith({ cmd: "down" });
    expect(t.deps.logger.log).toHaveBeenCalledWith("procRunning error from backend: boom");
  });

  it("disables the proxy on init error and tolerates disable failure", async () => {
    t.deps.proxy.disable.mockRejectedValueOnce(new Error("x"));
    t.session.start();
    await flush();
    t.ports[0]!.msg({ init: { error: "bad" } });
    await flush();
    expect(t.deps.proxy.disable).toHaveBeenCalled();
    expect(t.deps.logger.error).toHaveBeenCalled();
    expect(t.session.isProxyEnabled).toBe(false);
  });

  describe("toggleProxy", () => {
    it("refuses to enable while disconnected", async () => {
      t.session.start();
      await flush();
      const res = await t.session.toggleProxy();
      expect(res).toEqual({ status: {} });
      expect(t.session.isProxyEnabled).toBe(false);
      expect(t.deps.logger.error).toHaveBeenCalled();
      expect(t.deps.setIcon).toHaveBeenLastCalledWith("offline");
    });

    it("sends up, then get-status once a port is known", async () => {
      t.session.start();
      await flush();
      t.ports[0]!.msg({ status: { running: true } });
      await flush();
      const res = await t.session.toggleProxy();
      expect(res).toEqual({ status: { running: true } });
      expect(t.ports[0]!.port.postMessage).toHaveBeenCalledWith({ cmd: "up" });
      expect(t.deps.setIcon).toHaveBeenLastCalledWith("online");

      t.ports[0]!.msg({ procRunning: { port: 9, pid: 1, error: "" } });
      await flush();
      expect(t.session.proxyPort).toBe(9);
    });

    it("sends down and reports Disconnected when turning off", async () => {
      t.session.start();
      await flush();
      t.ports[0]!.msg({ procRunning: { port: 9, pid: 1, error: "" } });
      await flush();
      const res = await t.session.toggleProxy();
      expect(res).toEqual({ status: "Disconnected" });
      expect(t.ports[0]!.port.postMessage).toHaveBeenCalledWith({ cmd: "down" });
      expect(t.deps.proxy.disable).toHaveBeenCalled();
      expect(t.session.proxyPort).toBe(0);
      expect(t.deps.setIcon).toHaveBeenLastCalledWith("offline");
    });
  });

  describe("disconnect", () => {
    it("marks dead, disables proxy, and notifies without retry when no error", async () => {
      const cb = vi.fn();
      t.session.onChange(cb);
      t.session.start();
      await flush();
      t.ports[0]!.msg({});
      await flush();
      cb.mockClear();
      t.ports[0]!.disc();
      await flush();
      expect(t.session.isDead).toBe(true);
      expect(t.deps.setIcon).toHaveBeenCalledWith("need-install");
      expect(t.deps.proxy.disable).toHaveBeenCalled();
      expect(t.deps.setTimeout).not.toHaveBeenCalled();
      expect(cb).toHaveBeenCalledOnce();
    });

    it("reconnects after 1000 ms when lastError is set", async () => {
      t.session.start();
      await flush();
      t.setLastError({ message: "no host" });
      t.ports[0]!.disc();
      expect(t.deps.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
      t.timers[0]!();
      expect(t.deps.connectNative).toHaveBeenCalledTimes(2);
    });

    it("does not reconnect when the port is already alive", async () => {
      t.session.start();
      await flush();
      t.setLastError({ message: "late" });
      t.ports[0]!.disc();
      t.ports[0]!.msg({});
      await flush();
      t.timers[0]!();
      expect(t.deps.connectNative).toHaveBeenCalledTimes(1);
    });
  });
});
