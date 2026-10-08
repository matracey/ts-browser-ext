import type { UserManifest } from "wxt";

const SHARED_PERMISSIONS = ["proxy", "storage", "nativeMessaging"];

export const FIREFOX_EXTENSION_ID = "browser-ext@tailscale.com";

// Firefox only supports Manifest V3 from 109 onwards.
export const FIREFOX_MIN_VERSION = "109.0";

export function createManifest(browser: string): UserManifest {
  const isFirefox = browser === "firefox";
  return {
    name: "Tailscale Extension",
    description:
      "A Tailscale client that runs as a browser extension, permitting use of different tailnets in different browser profiles, without affecting the system VPN or networking settings.",
    permissions: isFirefox
      ? SHARED_PERMISSIONS
      : [...SHARED_PERMISSIONS, "background"],
    host_permissions: ["<all_urls>"],
    ...(isFirefox && {
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_EXTENSION_ID,
          strict_min_version: FIREFOX_MIN_VERSION,
        },
      },
    }),
  };
}