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

  it("treats Chromium-based browsers like Chrome", () => {
    expect(createManifest("edge").permissions).toContain("background");
  });
});