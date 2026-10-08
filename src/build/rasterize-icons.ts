import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { ICON_NAMES, ICON_SIZES, iconPath } from "../shared/icons";

export interface RasterizedIcon {
  absoluteSrc: string;
  relativeDest: string;
}

export function rasterizeSvg(svg: string, size: number): Buffer {
  // Icons contain no text, and scanning system fonts makes each render slow.
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

// Renders every SVG source to a PNG per size so the repo only stores vectors.
export async function rasterizeIcons(
  srcDir: string,
  outDir: string,
): Promise<RasterizedIcon[]> {
  const icons: RasterizedIcon[] = [];
  for (const name of ICON_NAMES) {
    const svg = await readFile(join(srcDir, `${name}.svg`), "utf8");
    for (const size of ICON_SIZES) {
      const relativeDest = iconPath(name, size);
      const absoluteSrc = join(outDir, relativeDest);
      await mkdir(dirname(absoluteSrc), { recursive: true });
      await writeFile(absoluteSrc, rasterizeSvg(svg, size));
      icons.push({ absoluteSrc, relativeDest });
    }
  }
  return icons;
}
