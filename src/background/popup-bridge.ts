import type { PopupMessage } from "../shared/protocol";
import { POPUP_PORT_NAME } from "../shared/protocol";
import type { BrowserConfig } from "./browser-config";
import { buildInstallCommand } from "./browser-config";
import type { NativeSession } from "./native-session";

export interface PopupPortLike {
  name: string;
  postMessage(message: unknown): void;
  onDisconnect: { addListener(cb: () => void): void };
}

export interface PopupBridgeDeps {
  config: BrowserConfig;
  session: Pick<NativeSession, "snapshot" | "onChange" | "refreshIcon">;
  extensionId: string;
  isAllowedIncognitoAccess(): Promise<boolean>;
}

export class PopupBridge {
  private popupPort: PopupPortLike | null = null;

  constructor(private readonly deps: PopupBridgeDeps) {
    deps.session.onChange(() => void this.sendStatus());
  }

  get connected(): boolean {
    return this.popupPort !== null;
  }

  // Wire to runtime.onConnect.
  handleConnect(port: PopupPortLike): void {
    if (port.name !== POPUP_PORT_NAME) {
      return;
    }
    this.popupPort = port;
    port.onDisconnect.addListener(() => {
      if (this.popupPort === port) {
        this.popupPort = null;
      }
    });
    void this.sendStatus();
  }

  async sendStatus(): Promise<void> {
    const { config, session, extensionId } = this.deps;
    session.refreshIcon();
    if (config.checksIncognitoAccess) {
      // Firefox only lets extensions set proxies with private browsing access.
      const allowed = await this.deps.isAllowedIncognitoAccess();
      if (!allowed) {
        this.send({ needsIncognitoPermission: true });
      }
    }
    const { deadPort, lastStatus } = session.snapshot();
    if (deadPort) {
      this.send({ installCmd: buildInstallCommand(config, extensionId) });
    } else {
      this.send({ status: lastStatus });
    }
  }

  private send(message: PopupMessage): void {
    this.popupPort?.postMessage(message);
  }
}
