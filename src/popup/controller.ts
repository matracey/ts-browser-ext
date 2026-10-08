import type { PopupMessage, ToggleProxyCommand, ToggleProxyResponse } from "../shared/protocol";
import { presentMessage, presentStatus, type StatusContent, type StatusView } from "./presenter";

export const SETTINGS_URL = "http://100.100.100.100";

export interface PopupPort {
  onMessage: { addListener(listener: (message: PopupMessage) => void): void };
  disconnect(): void;
}

export interface PopupDeps {
  document: Document;
  port: PopupPort;
  sendMessage(message: ToggleProxyCommand): Promise<unknown>;
  openTab(url: string): void;
}

function requireElement<T extends Element>(doc: Document, selector: string): T {
  const el = doc.querySelector<T>(selector);
  if (!el) throw new Error(`Popup markup is missing ${selector}`);
  return el;
}

export function startPopup(deps: PopupDeps): void {
  const { document: doc, port, sendMessage, openTab } = deps;
  const toggle = requireElement<HTMLInputElement>(doc, "#toggleSlider");
  const slider = requireElement<HTMLElement>(doc, ".slider");
  const settingsButton = requireElement<HTMLButtonElement>(doc, "#settingsButton");
  const stateDisplay = requireElement<HTMLElement>(doc, "#state");

  let isLoading = true;
  let isConnected = false;

  function link(text: string, url: string): HTMLElement {
    const bold = doc.createElement("b");
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.textContent = text;
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      openTab(url);
    });
    bold.append(anchor);
    return bold;
  }

  function renderContent(content: StatusContent): void {
    switch (content.type) {
      case "text":
        stateDisplay.textContent = content.text;
        break;
      case "link":
        stateDisplay.replaceChildren(link(content.text, content.url));
        break;
      case "login":
        if (content.url) {
          stateDisplay.replaceChildren(link("Log in", content.url));
        } else {
          const bold = doc.createElement("b");
          bold.textContent = "Login required; no URL";
          stateDisplay.replaceChildren(bold);
        }
        break;
      case "install": {
        const bold = doc.createElement("b");
        bold.textContent = "Installation needed. Run:";
        const pre = doc.createElement("pre");
        pre.textContent = content.command;
        stateDisplay.replaceChildren(bold, pre);
        break;
      }
    }
  }

  function renderSlider(): void {
    if (isLoading) {
      slider.className = "slider loading";
      toggle.checked = true;
      return;
    }
    slider.className = isConnected ? "slider connected" : "slider";
    toggle.checked = isConnected;
  }

  function apply(view: StatusView): void {
    if (view.settled) isLoading = false;
    if (view.content) renderContent(view.content);
    if (view.locked) {
      toggle.disabled = true;
      settingsButton.hidden = true;
    }
    if (view.connected !== undefined) {
      isConnected = view.connected;
      renderSlider();
    }
  }

  port.onMessage.addListener((msg) => {
    const view = presentMessage(msg);
    if (view) apply(view);
  });

  toggle.addEventListener("change", () => {
    void sendMessage({ command: "toggleProxy" }).then((response) => {
      const status = (response as ToggleProxyResponse | undefined)?.status;
      if (status) apply(presentStatus(status));
    });
  });

  settingsButton.addEventListener("click", () => openTab(SETTINGS_URL));

  doc.defaultView?.addEventListener("beforeunload", () => port.disconnect());
}
