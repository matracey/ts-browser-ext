import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: {
    name: "Tailscale Extension",
    description:
      "A Tailscale client that runs as a browser extension, permitting use of different tailnets in different browser profiles, without affecting the system VPN or networking settings.",
  },
});
