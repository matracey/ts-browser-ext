import { describe, expect, it } from "vitest";
import {
  createManifest,
  FIREFOX_EXTENSION_ID,
  FIREFOX_MIN_VERSION,
} from "./manifest";

describe("createManifest", () => {
  it("requests background permission on Chrome without gecko settings", () => {
    const manifest = createManifest("chrome");
    expect(manifest.permissions).toEqual([
      "proxy",
      "storage",
      "nativeMessaging",
      "background",
    ]);
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
    expect(manifest.browser_specific_settings).toBeUndefined();
  });

  it("omits background permission and pins the gecko id on Firefox", () => {
    const manifest = createManifest("firefox");
    expect(manifest.permissions).toEqual(["proxy", "storage", "nativeMessaging"]);
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
    expect(manifest.browser_specific_settings).toEqual({
      gecko: { id: FIREFOX_EXTENSION_ID, strict_min_version: FIREFOX_MIN_VERSION },
    });
  });

  it("uses the generated online icons for the extension and action", () => {
    const manifest = createManifest("chrome");
    const icons = {
      16: "icons/online-16.png",
      32: "icons/online-32.png",
      48: "icons/online-48.png",
      128: "icons/online-128.png",
    };
    expect(manifest.icons).toEqual(icons);
    expect(manifest.action).toEqual({ default_icon: icons });
  });

  it("treats Chromium-based browsers like Chrome", () => {
    expect(createManifest("edge").permissions).toContain("background");
  });
});