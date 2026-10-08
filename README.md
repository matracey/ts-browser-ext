# Tailscale Browser Extension (Experiment)

[![status: experimental](https://img.shields.io/badge/status-experimental-blue)](https://tailscale.com/kb/1167/release-stages/#experimental)

The [Tailscale](https://tailscale.com/) Browser Extension lets you access your tailnet resources
using a browser extension, without necessarily installing Tailscale
system-wide.

In particular, ...

* you can **simultaneously use a different tailnet per browser profile**
  * separate out your personal tailnet in its own browser profile
* you don't need to be root/admin to install it
* it doesn't interfere with your other OS VPN(s) and route tables and is purely scoped to one browser profile

## How it works

Ideally it would work purely with WASM/WASI, but browser extensions
don't have enough APIs, so it regrettably has to use Native Messaging
([Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging),
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging))
where a native binary (using
[`tsnet`](https://tailscale.com/kb/1244/tsnet)) runs as a child
process under the browser and communicates with the browser extension
with JSON messages back and forth.

The child process then runs an HTTP/SOCKS5 proxy on `localhost:0`
(with the kernel picking a random free port) and the browser extension
uses the browser proxy API to send all web traffic through the child's
proxy, which then sends it out over Tailscale, an exit node, or the
Internet as normal.

## Status

As of 2025-02-25, this is **barely just starting to work** and is not
meant for end users yet. It's barely meant for developers at this
point.

| Browser    | OS | Status |
| -------- | ------- | ---- |
| Chrome  | macOS | Works |
| Chrome  | Linux | Works in theory, untested |
| Chrome  | Windows | Registry install work not yet done |
| Firefox  | macOS | Mostly works |
| Firefox  | Linux | Mostly works in theory, untested |
| Firefox  | Windows | Registry install work not yet done |
| Safari  | * | not possible; no support for Native Messaging |

## Installing from a release

Each [GitHub release](https://github.com/matracey/ts-browser-ext/releases) has prebuilt assets, so you don't need Bun or Go installed.

| Asset | What it is |
| --- | --- |
| `ts-browser-ext-<version>-chrome.zip` | Chrome extension |
| `ts-browser-ext-<version>-firefox.zip` | Unsigned Firefox extension |
| `*.xpi` | Signed Firefox extension, when AMO signing is configured |
| `ts-browser-ext-native-host_<os>_<arch>.tar.gz` | Native messaging host for Linux or macOS on amd64 or arm64 |
| `ts-browser-ext-native-host_checksums.txt` | SHA-256 checksums for the host archives |

### Chrome

1. Download and unzip `ts-browser-ext-<version>-chrome.zip` somewhere permanent. Chrome loads it from that folder, so don't delete it.
2. Open `chrome://extensions`, turn on "Developer mode", click "Load unpacked", and select the unzipped folder.
3. Click the extension icon. The popup shows an `--install=C<extension-id>` argument.
4. Download the native host archive for your platform, extract it, and register it with that argument:

   ```shell
   tar -xzf ts-browser-ext-native-host_darwin_arm64.tar.gz
   ./ts-browser-ext --install=C<extension-id>
   ```

5. Click the extension icon again and select "Log in".

### Firefox

1. Open the signed `.xpi` from the release in Firefox and accept the install prompt. Unlike a temporary add-on, it survives restarts.
2. Download and extract the native host archive for your platform, then register it:

   ```shell
   ./ts-browser-ext --install=Fbrowser-ext@tailscale.com
   ```

3. Click the extension icon and select "Log in".

> [!NOTE]
>
> The `--install` step copies the binary into your browser's native messaging directory, so you can delete the extracted archive afterwards. Windows isn't supported yet.

### How releases are made

[release-please](https://github.com/googleapis/release-please) keeps a release PR open that bumps `package.json` from the Conventional Commits on `main`. Merging that PR tags `vX.Y.Z` and creates the release, then the release workflow builds and attaches the extension zips, signs the Firefox `.xpi` when the `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` secrets are set, and uses [GoReleaser](https://goreleaser.com/) to attach the native host archives.

## Developer instructions

To log out, for now you need to remove & re-add the extension.

### Prerequisites

- [Bun](https://bun.sh/) for the extension toolchain.
- Go, at the version pinned in `go.mod`, for the native messaging host. With [mise](https://mise.jdx.dev/), prefix Go commands with `mise exec go@1.26.3 --`.

### Building the extension

The extension is built with [WXT](https://wxt.dev/) from a single TypeScript source tree in `src/`. Both browsers use Manifest V3.

```powershell
bun install
bun run build           # Chrome, output in .output/chrome-mv3/
bun run build:firefox   # Firefox, output in .output/firefox-mv3/
```

For development, `bun run dev` and `bun run dev:firefox` rebuild on save and launch a browser with the extension loaded.

| Script | Purpose |
| --- | --- |
| `bun run typecheck` | Type check with `tsc --noEmit` |
| `bun run test` | Run the Vitest unit tests |
| `bun run test:coverage` | Run tests with the 80% coverage gate |
| `bun run zip` / `bun run zip:firefox` | Package a build for distribution |

> [!NOTE]
>
> Browser-specific code lives behind the proxy adapters in `src/background/proxy/`. The build selects the Chromium or Firefox adapter, so each bundle only contains its own implementation.

### Chrome

1. Run `bun run build`.
2. Open the Extensions page (`chrome://extensions`) or Extensions... > Manage Extensions...
3. Toggle "Developer mode" on.
4. Click "Load unpacked".
5. Select the `.output/chrome-mv3/` directory in your clone of this repo.
6. Pin the extension to the toolbar.
7. Click the extension icon.
8. Follow the instructions in the popup to run the printed `go run ...` command, which builds and registers the native messaging backend. If Go comes from mise, run it as `mise exec go@1.26.3 -- go run ...`.
9. Click the extension icon again and select "Log in".

### Firefox

1. Run `bun run build:firefox`.
2. Open the Debugging page (`about:debugging#/runtime/this-firefox`).
3. Click "Load Temporary Add-on...".
4. Select `.output/firefox-mv3/manifest.json` in your clone of this repo.
5. Open the Add-ons Manager (`about:addons`), select the Tailscale extension, and under "Run in Private Windows" choose "Allow" if you want it to be active in private browsing.
6. Pin the extension to the toolbar.
7. Click the extension icon.
8. Follow the instructions in the popup to run the printed `go run ...` command, which builds and registers the native messaging backend. If Go comes from mise, run it as `mise exec go@1.26.3 -- go run ...`.
9. Click the extension icon again and select "Log in".

Temporary add-ons in Firefox are removed when the browser restarts, so you'll need to reload it from `about:debugging` each session.

## End user instructions

Don't use it yet. It's too rough. See status above.
