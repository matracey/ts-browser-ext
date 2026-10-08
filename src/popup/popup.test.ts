import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PopupMessage } from "../shared/protocol";
import { SETTINGS_URL, startPopup, type PopupPort } from "./controller";
import { PRIVATE_BROWSING_HELP_URL, presentMessage, presentStatus } from "./presenter";

const MARKUP = `
  <label><input type="checkbox" id="toggleSlider" checked />
  <span class="slider connected no-transition"></span></label>
  <div id="state"></div>
  <button id="settingsButton">Settings</button>`;

function setup(sendMessage: (m: unknown) => Promise<unknown> = () => Promise.resolve(undefined)) {
  document.body.innerHTML = MARKUP;
  let listener: (m: PopupMessage) => void = () => {};
  const port: PopupPort = {
    onMessage: { addListener: (l) => (listener = l) },
    disconnect: vi.fn(),
  };
  const openTab = vi.fn();
  const send = vi.fn(sendMessage);
  startPopup({ document, port, sendMessage: send, openTab });
  return {
    port,
    openTab,
    send,
    push: (m: PopupMessage) => listener(m),
    toggle: document.querySelector<HTMLInputElement>("#toggleSlider")!,
    slider: document.querySelector<HTMLElement>(".slider")!,
    state: document.querySelector<HTMLElement>("#state")!,
    settings: document.querySelector<HTMLButtonElement>("#settingsButton")!,
  };
}

describe("presenter", () => {
  it("maps each status shape", () => {
    expect(presentStatus("Disconnected")).toMatchObject({ connected: false });
    expect(presentStatus({ error: "State: Stopped" })).toMatchObject({ connected: false });
    expect(presentStatus({ error: "boom" })).toEqual({
      settled: true,
      locked: false,
      content: { type: "text", text: "Error: boom" },
    });
    expect(presentStatus({ running: true, tailnet: "t" }).content).toEqual({
      type: "text",
      text: "Connected as t",
    });
    expect(presentStatus({ running: true, tailnet: "" }).content).toEqual({
      type: "text",
      text: "Connected as Not connected",
    });
    expect(presentStatus({ running: false })).toMatchObject({ connected: false });
    expect(presentStatus({})).toEqual({ settled: true, locked: false });
  });

  it("only allows http(s) login URLs", () => {
    const url = (u?: string) =>
      presentStatus({ needsLogin: true, browseToURL: u as string }).content;
    expect(url("https://login.tailscale.com/a")).toEqual({
      type: "login",
      url: "https://login.tailscale.com/a",
    });
    expect(url("javascript:alert(1)")).toEqual({ type: "login", url: undefined });
    expect(url("not a url")).toEqual({ type: "login", url: undefined });
    expect(url(undefined)).toEqual({ type: "login", url: undefined });
  });

  it("maps messages", () => {
    expect(presentMessage({ needsIncognitoPermission: true })?.content).toMatchObject({
      url: PRIVATE_BROWSING_HELP_URL,
    });
    expect(presentMessage({ installCmd: "x" })).toMatchObject({ locked: true });
    expect(presentMessage({ error: "e" })).toMatchObject({ locked: true });
    expect(presentMessage({ status: "Disconnected" })).toMatchObject({ connected: false });
    expect(presentMessage({ installCmd: "" } as PopupMessage)).toBeUndefined();
  });
});

describe("popup controller", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("throws when markup is missing", () => {
    document.body.innerHTML = "";
    expect(() =>
      startPopup({
        document,
        port: { onMessage: { addListener() {} }, disconnect() {} },
        sendMessage: () => Promise.resolve(),
        openTab() {},
      }),
    ).toThrow(/missing/);
  });

  it("shows connected and disconnected states", () => {
    const p = setup();
    p.push({ status: { running: true, tailnet: "example.ts.net" } });
    expect(p.state.textContent).toBe("Connected as example.ts.net");
    expect(p.slider.className).toBe("slider connected");
    expect(p.toggle.checked).toBe(true);
    p.push({ status: { running: false } });
    expect(p.state.textContent).toBe("Disconnected");
    expect(p.slider.className).toBe("slider");
    expect(p.toggle.checked).toBe(false);
  });

  it("handles stopped and literal Disconnected statuses", () => {
    const p = setup();
    p.push({ status: { error: "State: Stopped" } });
    expect(p.state.textContent).toBe("Disconnected");
    p.push({ status: { running: true, tailnet: "t" } });
    p.push({ status: "Disconnected" });
    expect(p.slider.className).toBe("slider");
  });

  it("keeps the loading look for errors before any state", () => {
    const p = setup();
    p.push({ status: { error: "bad" } });
    expect(p.state.textContent).toBe("Error: bad");
    expect(p.slider.className).toBe("slider connected no-transition");
    p.push({ status: {} });
    expect(p.state.textContent).toBe("Error: bad");
  });

  it("renders a login link that opens a tab", () => {
    const p = setup();
    p.push({ status: { needsLogin: true, browseToURL: "https://login.example/x" } });
    const a = p.state.querySelector("b > a") as HTMLAnchorElement;
    expect(a.textContent).toBe("Log in");
    a.click();
    expect(p.openTab).toHaveBeenCalledWith("https://login.example/x");
  });

  it("renders login without a URL", () => {
    const p = setup();
    p.push({ status: { needsLogin: true, browseToURL: "" } });
    expect(p.state.innerHTML).toBe("<b>Login required; no URL</b>");
  });

  it("does not interpret markup in data", () => {
    const p = setup();
    p.push({ installCmd: "<img src=x onerror=alert(1)>" });
    expect(p.state.querySelector("img")).toBeNull();
    expect(p.state.querySelector("pre")?.textContent).toBe("<img src=x onerror=alert(1)>");
    p.push({ error: "<b>x</b>" });
    expect(p.state.querySelector("b")).toBeNull();
  });

  it("handles install command", () => {
    const p = setup();
    p.push({ installCmd: "run me" });
    expect(p.state.querySelector("b")?.textContent).toBe("Installation needed. Run:");
    expect(p.state.querySelector("pre")?.textContent).toBe("run me");
    expect(p.toggle.disabled).toBe(true);
    expect(p.settings.hidden).toBe(true);
  });

  it("handles background errors", () => {
    const p = setup();
    p.push({ error: "nope" });
    expect(p.state.textContent).toBe("nope");
    expect(p.toggle.disabled).toBe(true);
    expect(p.settings.hidden).toBe(true);
  });

  it("handles incognito permission", () => {
    const p = setup();
    p.push({ needsIncognitoPermission: true });
    const a = p.state.querySelector("a") as HTMLAnchorElement;
    expect(a.textContent).toBe("Enable private browsing access.");
    a.click();
    expect(p.openTab).toHaveBeenCalledWith(PRIVATE_BROWSING_HELP_URL);
  });

  it("ignores unknown messages", () => {
    const p = setup();
    p.push({} as PopupMessage);
    expect(p.state.textContent).toBe("");
  });

  it("sends toggleProxy and renders the response", async () => {
    const p = setup(() => Promise.resolve({ status: "Disconnected" }));
    p.toggle.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(p.slider.className).toBe("slider"));
    expect(p.send).toHaveBeenCalledWith({ command: "toggleProxy" });
    expect(p.state.textContent).toBe("Disconnected");
  });

  it("ignores empty toggle responses", async () => {
    const p = setup(() => Promise.resolve(undefined));
    p.toggle.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    expect(p.state.textContent).toBe("");
  });

  it("opens settings", () => {
    const p = setup();
    p.settings.click();
    expect(p.openTab).toHaveBeenCalledWith(SETTINGS_URL);
  });

  it("disconnects the port on unload", () => {
    const p = setup();
    window.dispatchEvent(new Event("beforeunload"));
    expect(p.port.disconnect).toHaveBeenCalled();
  });
});
