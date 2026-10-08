import { describe, expect, it } from "vitest";
import { ICON_NAMES, ICON_SIZES, iconPath, iconPathMap } from "./icons";

describe("icons", () => {
  it("covers every icon state", () => {
    expect(ICON_NAMES).toEqual(["online", "offline", "need-install"]);
  });

  it("builds a per-size output path", () => {
    expect(iconPath("need-install", 48)).toBe("icons/need-install-48.png");
  });

  it("maps every size to a path with an optional prefix", () => {
    expect(iconPathMap("online")).toEqual({
      16: "icons/online-16.png",
      32: "icons/online-32.png",
      48: "icons/online-48.png",
      128: "icons/online-128.png",
    });
    expect(Object.keys(iconPathMap("offline", "/"))).toHaveLength(ICON_SIZES.length);
    expect(iconPathMap("offline", "/")[16]).toBe("/icons/offline-16.png");
  });
});
