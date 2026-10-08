// Wire types for the native messaging host in ts-browser-ext.go.
// Field names must match the Go JSON tags exactly.

export type NativeCommand = "init" | "up" | "down" | "get-status";

export type NativeRequest =
  | { cmd: "init"; initID: string }
  | { cmd: "up" }
  | { cmd: "down" }
  | { cmd: "get-status" };

export interface ProcRunningResult {
  port: number;
  pid: number;
  error: string;
}

export interface InitResult {
  error: string;
}

export interface TailscaleStatus {
  running: boolean;
  tailnet: string;
  error?: string;
  needsLogin?: boolean;
  browseToURL: string;
}

export interface NativeReply {
  procRunning?: ProcRunningResult;
  status?: TailscaleStatus;
  init?: InitResult;
}

// Messages pushed from the background to the popup over the "popup" port.
export type PopupMessage =
  | { installCmd: string }
  | { needsIncognitoPermission: true }
  | { error: string }
  | { status: PopupStatus };

// The legacy Chrome background replies with the literal string
// "Disconnected" when the proxy is toggled off, so the popup accepts it.
export type PopupStatus = Partial<TailscaleStatus> | "Disconnected";

export const POPUP_PORT_NAME = "popup";

export interface ToggleProxyCommand {
  command: "toggleProxy";
}

export interface ToggleProxyResponse {
  status: PopupStatus;
}

export type IconName = "online" | "offline" | "need-install";

export function isToggleProxyCommand(value: unknown): value is ToggleProxyCommand {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { command?: unknown }).command === "toggleProxy"
  );
}

export function isNativeReply(value: unknown): value is NativeReply {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
