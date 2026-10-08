// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ICON_NAMES, ICON_SIZES } from "../shared/icons";
import { rasterizeIcons, rasterizeSvg } from "./rasterize-icons";

const SRC_DIR = join(__dirname, "..", "assets", "icons");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function pngSize(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("rasterizeSvg", () => {
  it("renders a square PNG at the requested width", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    const png = rasterizeSvg(svg, 32);
    expect(png.subarray(0, 4)).toEqual(PNG_SIGNATURE);
    expect(pngSize(png)).toEqual({ width: 32, height: 32 });
  });
});

describe("rasterizeIcons", () => {
  let outDir: string | undefined;

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("writes every icon state at every size", async () => {
    outDir = await mkdtemp(join(tmpdir(), "ts-icons-"));
    const icons = await rasterizeIcons(SRC_DIR, outDir);

    expect(icons).toHaveLength(ICON_NAMES.length * ICON_SIZES.length);
    expect(icons).toContainEqual({
      absoluteSrc: join(outDir, "icons/need-install-128.png"),
      relativeDest: "icons/need-install-128.png",
    });

    const png = await readFile(join(outDir, "icons/online-48.png"));
    expect(pngSize(png)).toEqual({ width: 48, height: 48 });
  });
});
