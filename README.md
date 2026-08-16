# `dsh-webview-wrapper`

English | [中文](README.zh.md)

A naive native desktop shell for the DeepSeek Harness Web surface. `dsh-webview-wrapper` is an out-of-tree [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) plugin that hosts the already-running Web app in an OS-native window through [WebviewJS](https://webview.js.org) — the platform's own webview engine (WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux), never a bundled browser. No Electron, no fork, no patch to the harness.

In keeping with the **everything-is-a-plugin** philosophy, the integration is pure composition. The package installs into a profile like any out-of-tree plugin, its bundle patch layer inserts one plugin row, and the plugin mounts itself once the Web composition provides the `webServer` / `webRuntime` services. The harness itself stays a stock installation.

## Features

- Native window + system tray for the exact surface `dsh web` serves.
- Close-to-tray: closing the window hides it and the harness keeps running (an invisible 1×1 keep-alive window holds the process alive).
- Tray menu (`Show` / `Quit`) and tray double-click.
- Clean teardown: unloading the plugin — or shutting the profile down — exits the native app through the effect disposer.
- Invariant companion (`dsh-webview-wrapper/invariant`) registered with the `InvariantRegistry`.

## Installation

Prerequisites:

- A stock deepseek-harness installation whose profile mounts the Web bundle (`dsh web`). The wrapper injects `webServer` and `webRuntime`, so the target profile must be Web-based — the shipped `web` profile is the natural target.
- The WebviewJS platform requirements: Windows → WebView2 (ships with Windows 11 and current Edge), macOS → built-in WebKit (10.15+), Linux → WebKitGTK 4.1 and `libxdo`.
- `pnpm` (the plugin manager forwards its arguments to pnpm).

### Quick start

```sh
dsh plugin --profile web add dsh-webview-wrapper
dsh --profile web
```

### Custom profile

The shipped `web` profile already lists the Web layers (`@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`) in its `dsh.profile.bundles`. To use a custom profile, copy it and add only the wrapper:

```sh
cp -r ~/.dsh/profiles/web ~/.dsh/profiles/ww
dsh plugin --profile ww add dsh-webview-wrapper
dsh --profile ww
```

### What `add` does, step by step

1. `dsh plugin` initializes the profile on first use, then runs `pnpm add` in the profile directory.
2. Because `dsh-webview-wrapper` declares `dsh.bundle.patch` in its manifest, the plugin manager automatically appends it to the profile's `dsh.profile.bundles` layer stack.
3. On the next boot, the bundle's patch layer ([`cordis.patch.yml`](cordis.patch.yml)) inserts the `webview` plugin row into the composition.
4. The plugin waits for `webServer` / `webRuntime`, then owns the native window lifecycle.

### One rule: don't `add` the in-box bundles

`dsh plugin add` is only for **out-of-tree** plugins. The Web bundles (`@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`) are **in-box**: they load from the harness installation and belong in `dsh.profile.bundles` — never in the profile's `dependencies`. `add`ing an in-box bundle makes pnpm materialize the whole harness tree inside the profile's `node_modules`:

- pnpm installs it with `autoInstallPeers: false`, so the tree is missing its peers (e.g. `@deepseek-ai/cordis`); `pnpm peers check` inside the profile reports them.
- At boot the loader resolves plugins from the profile directory, so those copies shadow the installation (the `$DSH_HOME/profiles/node_modules` junctions) and fail to load — tool calls error.
- A first symptom along the way: `@deepseek-ai/dsh-web-app` pulls in the harness's native directory picker, whose `koffi` dependency has an unapproved build script; pnpm 11 (default `strict-dep-builds: true`) exits non-zero (`ERR_PNPM_IGNORED_BUILDS`), `dsh plugin` skips the `dsh.profile.bundles` reconcile, and the profile boots without the Web layers.

To get out of that state, drop the in-box bundle from `dependencies` (keep it in `dsh.profile.bundles` — it resolves from the installation), run `pnpm install` in the profile directory to prune the harness tree, and boot again.

### Running a local checkout

Build the checkout first, then install from the folder:

```sh
pnpm run build
dsh plugin --profile web add file:/absolute/path/to/dsh-webview-wrapper
```

## Usage

- **First boot starts in the tray** — no main window is created until you ask for it. Double-click the tray icon or choose `Show` to open the 1024×768 window hosting `http://127.0.0.1:<port>` (the live Web surface).
- Closing the window hides it to the tray; the harness keeps running.
- `Quit` in the tray menu exits the application.

## How it works

| File | Role |
|---|---|
| `src/index.ts` | The plugin: creates the WebviewJS `Application`, the tray, and the main window; routes `custom-menu-click`, `window-close-requested`, and `application-close-requested`; calls `app.exit()` on disposal. |
| `cordis.patch.yml` | The bundle patch layer: inserts `{ id: webview, name: 'dsh-webview-wrapper' }` into the composition. |
| `src/invariant.ts` | The invariant companion, registering the package with the `InvariantRegistry`. |
| `assets/icon.svg` | Taskbar / tray icon source, rasterized with `sharp`. |

Lifecycle sketch:

```
apply(ctx)
├─ readIcon(icon.svg, 16)          # one shared async rasterization
└─ ctx.effect(() =>                 # plugin lifetime == native app lifetime
   ├─ new Application()
   ├─ whenReady() → 1×1 keep-alive window + tray (Show/Quit)
   ├─ tray double-click / Show → createOrShowMainWindow()
   │    └─ BrowserWindow(1024×768) + webview → http://127.0.0.1:<ctx.webServer.port>
   ├─ window-close-requested → hide (close-to-tray)
   └─ disposer → app.exit()
```

## Known limitations and roadmap

The wrapper is deliberately naive; the rough edges below are the roadmap:

1. **No native notifications** — nothing in the harness surfaces as an OS notification. Roadmap: WebviewJS `Notification`.
2. **Generic HTTP transport** — the webview loads the Web app over `http://127.0.0.1:<port>`, the same browser HTTP carrier any tab uses. Roadmap: replace it with WebviewJS IPC (`webview.expose()` / `window.ipc.postMessage`) and/or a custom protocol, dropping the loopback-HTTP dependency.
3. **No menu bar** — only the tray menu exists. Roadmap: `app.setMenu()` with File/Edit roles and accelerators.
4. **Console window + tray-only exit** — launching through the CLI shows the host console window, and the only exit paths are the tray `Quit` and profile shutdown. Roadmap: package as a GUI-subsystem executable (the WebviewJS CLI / Node SEA) so no console appears, and add an in-page quit affordance.

Other current rough edges: default fixed 1024×768 window with a hardcoded title (no config surface yet), and the main window is not opened at startup (the app starts in the tray).

## Development

```sh
git clone https://github.com/no1xsyzy/dsh-webview-wrapper.git
cd dsh-webview-wrapper
pnpm install
pnpm run build      # re-run after every change
dsh plugin --profile web add file:/absolute/path/to/dsh-webview-wrapper
```

For a private dev profile, copy `web` first as in [Custom profile](#custom-profile) — `add` only out-of-tree plugins, never the in-box `@deepseek-ai/dsh-web-app`.

Notes:

- **The workspace never runs the app.** The wrapper is a plugin: it only executes inside a profile composition (it injects `webServer` / `webRuntime`), so this checkout has no dev server and no standalone entrypoint — and its dependency chain ships prebuilt platform binaries, so there are no native addon builds either. Use the `dsh plugin ... add file:<path>` flow to test.
- `lib/` and `node_modules` are gitignored; `lib/` is build output.
- **Name discipline (npm publication).** The npm package name must stay identical across `package.json` `name`, the plugin name in `src/index.ts`, the bundle row in `cordis.patch.yml`, and the invariant registration in `src/invariant.ts`. The plugin manager resolves bundles and the `InvariantRegistry` keys registrations by npm name, so renaming means updating all four places.
- Keep `README.md` and `README.zh.md` in sync.
