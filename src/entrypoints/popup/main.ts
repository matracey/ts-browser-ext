import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import { browser } from "wxt/browser";
import { POPUP_PORT_NAME } from "../../shared/protocol";
import { startPopup } from "../../popup/controller";

startPopup({
  document,
  port: browser.runtime.connect({ name: POPUP_PORT_NAME }),
  sendMessage: (message) => browser.runtime.sendMessage(message),
  openTab: (url) => void browser.tabs.create({ url }),
});
