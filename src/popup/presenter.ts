import type { PopupMessage, PopupStatus } from "../shared/protocol";

export const PRIVATE_BROWSING_HELP_URL =
  "https://support.mozilla.org/en-US/kb/extensions-private-browsing#w_enabling-or-disabling-extensions-in-private-windows";

export type StatusContent =
  | { type: "text"; text: string }
  | { type: "login"; url: string | undefined }
  | { type: "install"; command: string }
  | { type: "link"; text: string; url: string };

export interface StatusView {
  content?: StatusContent;
  // Undefined leaves the slider untouched; a boolean sets it.
  connected?: boolean;
  // Marks the first rendered state as settled, which ends the loading look.
  settled: boolean;
  // Installation problems and background errors lock the UI.
  locked: boolean;
}

function safeLoginUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function presentStatus(status: PopupStatus): StatusView {
  const base = { settled: true, locked: false };
  if (status === "Disconnected") {
    return { ...base, content: { type: "text", text: "Disconnected" }, connected: false };
  }
  if (status.error) {
    if (status.error === "State: Stopped") {
      return { ...base, content: { type: "text", text: "Disconnected" }, connected: false };
    }
    return { ...base, content: { type: "text", text: `Error: ${status.error}` } };
  }
  if (status.needsLogin) {
    return { ...base, content: { type: "login", url: safeLoginUrl(status.browseToURL) } };
  }
  if (status.running !== undefined) {
    const text = status.running
      ? `Connected as ${status.tailnet || "Not connected"}`
      : "Disconnected";
    return { ...base, content: { type: "text", text }, connected: status.running };
  }
  return base;
}

export function presentMessage(msg: PopupMessage): StatusView | undefined {
  const loose = msg as Partial<Record<string, unknown>>;
  if (loose.needsIncognitoPermission) {
    return {
      settled: false,
      locked: false,
      content: { type: "link", text: "Enable private browsing access.", url: PRIVATE_BROWSING_HELP_URL },
    };
  }
  if (typeof loose.installCmd === "string" && loose.installCmd) {
    return { settled: false, locked: true, content: { type: "install", command: loose.installCmd } };
  }
  if (typeof loose.error === "string" && loose.error) {
    return { settled: false, locked: true, content: { type: "text", text: loose.error } };
  }
  if (loose.status) {
    return presentStatus(loose.status as PopupStatus);
  }
  return undefined;
}
