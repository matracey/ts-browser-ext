import { resolve } from "node:path";
import { defineConfig } from "wxt";
import { rasterizeIcons } from "./src/build/rasterize-icons";
import { createManifest } from "./src/manifest";

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: ({ browser }) => createManifest(browser),
  hooks: {
    "build:publicAssets": async (wxt, files) => {
      const icons = await rasterizeIcons(
        resolve(wxt.config.srcDir, "assets/icons"),
        resolve(wxt.config.wxtDir, "icons"),
      );
      files.push(...icons);
    },
  },
});
