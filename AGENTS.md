# AGENTS.md

Guidance for AI agents and human contributors working in this repository.

## What this is

`dsh-webview-wrapper` is an out-of-tree [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) plugin: a naive native desktop shell that hosts the Harness Web surface in an OS window via [WebviewJS](https://webview.js.org). It follows the harness's *everything-is-a-plugin* philosophy — pure composition, never a fork of or a patch to deepseek-harness itself. The repo is intentionally small: one plugin, one bundle patch, one invariant companion, one icon.

## Commands

| Command | Purpose |
|---|---|
| `pnpm install` | Install dev dependencies. |
| `pnpm run build` | `tsc -p tsconfig.json` → compiled plugin plus types in `lib/`. There is no test suite yet; the build is the primary verification. |
| `npm pack --dry-run` | Inspect the exact publish tarball (12 files, ≈12 kB). Under a file sandbox that blocks the npm cache, add `--cache <in-workspace-dir>`. |

There is no dev server, and the app cannot run from this checkout: `pnpm-workspace.yaml` blocks the WebviewJS native addon builds (`koffi`, `libwebview-nodejs`) on purpose. The plugin runs only when composed into a profile:

```sh
pnpm run build
dsh plugin --profile web add file:/absolute/path/to/dsh-webview-wrapper
dsh --profile web
```

`dsh plugin add` runs `pnpm add` in the profile directory and — because this package declares `dsh.bundle.patch` — automatically appends the package to `dsh.profile.bundles`, which activates `cordis.patch.yml` as a bundle patch layer on the next boot.

## Repository map

| Path | Role |
|---|---|
| `src/index.ts` | The plugin. `inject: ['webRuntime', 'webServer']`; owns the WebviewJS `Application`, tray, main window, and event routing; the effect disposer calls `app.exit()`. |
| `cordis.patch.yml` | The bundle patch layer. Must stay minimal: it only inserts `{ id: webview, name: 'dsh-webview-wrapper' }` into the composition. |
| `src/invariant.ts` | The invariant companion (`dsh-webview-wrapper/invariant`). Registers the package with the `InvariantRegistry`; intentionally an empty installer (see constraints). |
| `assets/icon.svg` | Taskbar/tray icon source, rasterized by `sharp` (the Harness wordmark). |
| `package.json` | npm manifest. The `dsh.bundle.patch` declaration is what makes `dsh plugin` treat this package as a bundle. |
| `pnpm-workspace.yaml` | Blocks native addon builds locally; do not remove without a reason. |

## Conventions and constraints

1. **Everything-is-a-plugin, always.** All integration happens through the plugin contract: bundle patch layer + Cordis plugin + invariant companion. Never add a fork, a vendored copy of harness code, or a patch to the harness installation itself. If the harness lacks a seam, that is a harness feature request — not a reason to break composition.
2. **Name discipline.** The npm name is the identity: `package.json` `name`, `src/index.ts` `export const name`, the `name:` in `cordis.patch.yml`, and `PACKAGE_NAME` / the companion name in `src/invariant.ts` must all match (`dsh-webview-wrapper`). The plugin manager resolves bundles by package name and the `InvariantRegistry` keys registrations by npm name, so renaming means updating all four places plus the README pair and this file.
3. **Compose, don't reimplement.** The webview must keep loading the live surface from `ctx.webServer.port` — the plugin injects existing services instead of reimplementing transport, auth, or serving. The HTTP→IPC roadmap item still means wiring WebviewJS IPC to the *existing* services, not building a new transport inside this package.
4. **Dependency homes stay honest.** Runtime imports are only `@webviewjs/webview` and `sharp`; every harness package (`@deepseek-ai/cordis`, `dsh-host-webserver`, `dsh-invariants`) is type-only — tsc elides those imports, and the harness provides the actual services at runtime through the profile composition closure — so they live in `devDependencies`. Never add a harness package to `dependencies` unless a real value import of it survives compilation.
5. **Native lifecycle == plugin lifetime.** Everything happens inside `ctx.effect(...)`, and the disposer **must** call `app.exit()` — it is what makes plugin unload and profile shutdown tear the native app down. Keep that contract.
6. **WebviewJS handle discipline.** Retain strong references to `BrowserWindow`, `Webview`, and `TrayIcon` wrappers; discarded handles lose their listeners. The current code already does this (`mainWindow`, `keepAliveWindow`, `mainWebview`, `tray`).
7. **The invariant companion stays honest.** `src/invariant.ts` is an empty installer with a `No runtime invariant:` comment explaining why (composition-only wrapper; the consumed port is a boot fact owned by the webserver lifecycle; GUI behavior is external-toolkit territory and not runtime-assertable). This is the documented `dsh-invariants` convention for packages with no observable event/mutable-data relationship. The moment this package gains mutable state or an event protocol of its own — notifications, IPC routing, menu commands — update the comment and add a real check.
8. **Docs are a bilingual pair.** `README.md` and `README.zh.md` must stay in sync; `README.md` is the source of truth for the roadmap.
9. **The roadmap lives in the README.** The four known limitations (notifications, HTTP→IPC, menu bar, console window + in-page exit) are the roadmap. When implementing one, update the README pair and re-check the invariant comment (constraint 7).
10. **`lib/` is build output.** Never edit it; commit nothing under `lib/` or `node_modules`.

## Working notes

- The Web bundles are **in-box**: `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-web-app` belong in `dsh.profile.bundles` only (the shipped `web` template is the model) and must never be `add`ed into a profile's `dependencies` — `dsh plugin add` is for out-of-tree plugins like this wrapper. Adding `@deepseek-ai/dsh-web-app` as a dependency stacks two failures: (1) pnpm 11 (default `strict-dep-builds: true`) exits non-zero on the unapproved `koffi` build (pulled via `dsh-host-directory-picker-native`), so `dsh plugin` skips the bundles reconcile and `dsh.profile.bundles` never gains the rows; (2) even with the gate cleared, the profile-local harness tree was installed with `autoInstallPeers: false`, shadows the `$DSH_HOME/profiles/node_modules` installation junctions at boot, and fails to resolve its peers (`pnpm peers check` in the profile reports missing `@deepseek-ai/cordis` and others) — breaking tool calls regardless of `koffi`'s build state. The way out: remove the in-box bundle from `dependencies` (keep it in `bundles` — it resolves from the installation), `pnpm install` to prune the tree, reboot.
- The main window is **not** opened at startup — the app boots to the tray (keep-alive window + tray icon), and `createOrShowMainWindow` runs only on tray double-click / `Show`. That is current behavior, not a bug; making the window open on boot is a deliberate UX decision that belongs in the roadmap discussion.
- `window-close-requested` hides instead of closing (close-to-tray model). `application-close-requested` only logs.
- `iconReader` is a single shared async `sharp` promise created at `apply` time; both the window and the tray `then` off it. Fine today; revisit if icons become configurable.
- The install target must be a Web-based profile because the plugin injects `webServer` / `webRuntime`; on a non-Web profile the row simply stays pending on the missing services.
- The npm tarball must keep `assets/` (declared in `files`) — the icon is resolved at runtime from `lib/../assets/icon.svg`.
