import { browser } from "wxt/browser";
import {
  currentBrowserTarget,
  getBrowserConfig,
} from "../background/browser-config";
import { NativeSession, type PortLike } from "../background/native-session";
import { PopupBridge } from "../background/popup-bridge";
import { createChromiumProxyAdapter } from "../background/proxy/chromium";
import { createFirefoxProxyAdapter } from "../background/proxy/firefox";
import { iconPathMap } from "../shared/icons";
import { isToggleProxyCommand } from "../shared/protocol";

export default defineBackground(() => {
  const config = getBrowserConfig(currentBrowserTarget());

  const session = new NativeSession({
    config,
    proxy:
      import.meta.env.BROWSER === "firefox"
        ? createFirefoxProxyAdapter()
        : createChromiumProxyAdapter(),
    connectNative: (name) =>
      browser.runtime.connectNative(name) as unknown as PortLike,
    getProfileId: async () => {
      const { profileId } = await browser.storage.local.get("profileId");
      return typeof profileId === "string" ? profileId : undefined;
    },
    setProfileId: (profileId) => browser.storage.local.set({ profileId }),
    randomUUID: () => crypto.randomUUID(),
    setIcon: (name) => {
      browser.action
        .setIcon({ path: iconPathMap(name, "/") })
        .catch((error: unknown) => console.error("setIcon failed", error));
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    getLastError: () => browser.runtime.lastError,
  });

  const bridge = new PopupBridge({
    config,
    session,
    extensionId: browser.runtime.id,
    isAllowedIncognitoAccess: () =>
      browser.extension.isAllowedIncognitoAccess(),
  });

  browser.runtime.onConnect.addListener((port) => bridge.handleConnect(port));
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isToggleProxyCommand(message)) return;
    void session.toggleProxy().then(sendResponse);
    return true;
  });

  session.start();
});