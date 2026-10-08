import { defineConfig } from "wxt";
import { createManifest } from "./src/manifest";

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: ({ browser }) => createManifest(browser),
});