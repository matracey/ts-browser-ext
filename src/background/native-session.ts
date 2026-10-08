import type { IconName, NativeRequest, PopupStatus, ToggleProxyResponse } from "../shared/protocol";
import { isNativeReply } from "../shared/protocol";
import type { BrowserConfig } from "./browser-config";
import type { ProxyAdapter } from "./proxy/types";

export interface PortLike {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (message: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

export interface SessionLogger {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface NativeSessionDeps {
  config: BrowserConfig;
  proxy: ProxyAdapter;
  connectNative(name: string): PortLike;
  getProfileId(): Promise<string | undefined>;
  setProfileId(id: string): Promise<void>;
  randomUUID(): string;
  setIcon(name: IconName): void;
  setTimeout(fn: () => void, ms: number): unknown;
  getLastError(): { message?: string } | undefined | null;
  logger?: SessionLogger;
}

export interface SessionSnapshot {
  deadPort: boolean;
  proxyEnabled: boolean;
  lastStatus: PopupStatus;
}

export const RECONNECT_DELAY_MS = 1000;

export class NativeSession {
  private proxyEnabled = false;
  private lastProxyPort = 0;
  private lastStatus: PopupStatus = {};
  private deadPort = true;
  private profileID = "";
  private didInit = false;
  private nmPort: PortLike | null = null;
  private listeners: Array<() => void> = [];

  constructor(private readonly deps: NativeSessionDeps) {}

  private get logger(): SessionLogger {
    return this.deps.logger ?? console;
  }

  start(): void {
    this.connect();
    void this.loadProfileId();
  }

  // Registers a callback fired after every native message and disconnect.
  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  snapshot(): SessionSnapshot {
    return {
      deadPort: this.deadPort,
      proxyEnabled: this.proxyEnabled,
      lastStatus: this.lastStatus,
    };
  }

  get isProxyEnabled(): boolean {
    return this.proxyEnabled;
  }

  get proxyPort(): number {
    return this.lastProxyPort;
  }

  get isDead(): boolean {
    return this.deadPort;
  }

  get status(): PopupStatus {
    return this.lastStatus;
  }

  get initSent(): boolean {
    return this.didInit;
  }

  // Keeps the toolbar icon in step with the current state.
  refreshIcon(): void {
    if (this.deadPort) {
      this.deps.setIcon("need-install");
    } else {
      this.deps.setIcon(this.proxyEnabled ? "online" : "offline");
    }
  }

  async toggleProxy(): Promise<ToggleProxyResponse> {
    this.proxyEnabled = !this.proxyEnabled;
    let response: ToggleProxyResponse;
    if (this.proxyEnabled) {
      this.enableProxy();
      response = { status: this.lastStatus };
    } else {
      await this.disableProxy();
      response = { status: "Disconnected" };
    }
    this.deps.setIcon(this.proxyEnabled ? "online" : "offline");
    return response;
  }

  private connect(): void {
    if (this.nmPort && !this.deadPort) {
      return;
    }
    this.logger.log("Connecting to native messaging host...");
    const port = this.deps.connectNative(this.deps.config.nativeHostName);
    this.nmPort = port;

    port.onDisconnect.addListener(() => {
      this.deadPort = true;
      this.deps.setIcon("need-install");
      void this.disableProxy();
      const error = this.deps.getLastError();
      if (error) {
        this.logger.error("Connection failed:", error.message);
        this.deps.setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      } else {
        this.logger.error("Disconnected from native host");
      }
      this.notify();
    });

    port.onMessage.addListener((message) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isNativeReply(message)) {
      return;
    }
    this.deadPort = false;
    const { procRunning, init, status } = message;
    if (procRunning) {
      if (procRunning.port) {
        await this.setProxy(procRunning.port);
      } else if (procRunning.error) {
        this.logger.log("procRunning error from backend: " + procRunning.error);
        await this.disableProxy();
      }
    }
    if (init?.error) {
      this.logger.log("init error from backend: " + init.error);
      await this.disableProxy();
    }
    if (status) {
      this.lastStatus = status;
    }
    this.maybeSendInit();
    this.refreshIcon();
    this.notify();
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  private send(request: NativeRequest): void {
    this.nmPort?.postMessage(request);
  }

  private enableProxy(): void {
    if (this.deadPort) {
      this.logger.error("Cannot enable proxy, disconnected from native host");
      this.proxyEnabled = false;
      return;
    }
    this.send(this.lastProxyPort ? { cmd: "get-status" } : { cmd: "up" });
  }

  private async disableProxy(): Promise<void> {
    if (this.nmPort && !this.deadPort) {
      this.send({ cmd: "down" });
    }
    this.proxyEnabled = false;
    this.lastProxyPort = 0;
    try {
      await this.deps.proxy.disable();
    } catch (err) {
      this.logger.error("Failed to disable proxy:", err);
    }
  }

  private async setProxy(port: number): Promise<void> {
    this.proxyEnabled = true;
    this.lastProxyPort = port;
    try {
      await this.deps.proxy.enable(port);
    } catch (err) {
      this.logger.error("Failed to enable proxy:", err);
    }
  }

  private maybeSendInit(): void {
    if (!this.profileID || this.didInit || this.deadPort) {
      return;
    }
    this.send({ cmd: "init", initID: this.profileID });
    this.didInit = true;
  }

  private async loadProfileId(): Promise<void> {
    let id = await this.deps.getProfileId();
    if (!id) {
      id = this.deps.randomUUID();
      await this.deps.setProfileId(id);
      this.logger.log("Generated profile ID:", id);
    }
    this.profileID = id;
    this.maybeSendInit();
  }
}
