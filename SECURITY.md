# Security Policy / 安全策略

`dsh-webview-wrapper` is an out-of-tree [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) plugin: a naive native desktop shell that hosts the already-running Harness Web surface in an OS window via [WebviewJS](https://webview.js.org). It is a pure composition — no fork, no patch, and no reimplementation of transport, auth, or serving. This page explains what is in scope for security, how to report a vulnerability, and what to expect from the maintainer.

> `dsh-webview-wrapper` 是 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 out-of-tree 插件：一个通过 [WebviewJS](https://webview.js.org) 在操作系统窗口中承载 Harness Web 界面的原生桌面外壳。它是纯组合实现——不 fork、不 patch，也不重新实现传输、认证或服务。本页说明安全范围、漏洞报告方式以及维护者的响应预期。

## Scope / 安全范围

### What this package owns / 本包负责的部分

- `src/index.ts` — the plugin: the WebviewJS lifespan and wrap as Deepseek Harness plugin
  > `src/index.ts` —— 插件本体，管理 WebviewJS 生命周期并封装为 Deepseek Harness 插件
- `cordis.patch.yml` — the bundle patch layer that inserts the plugin into a profile's composition.
  > `cordis.patch.yml` —— 组合包补丁层，用于将上述插件插入 profile 组合层
- `src/invariant.ts` — the invariant companion (registration only, no runtime checks).
  > `src/invariant.ts` —— 不变式，当前仅注册无检查。
- The npm package and its published tarball.
  > npm 包和 tarball

The webview always loads the live surface from `http://127.0.0.1:<ctx.webServer.port>` — the same loopback carrier any browser tab uses. There is currently **no IPC bridge** between web content and native code (HTTP→IPC is a roadmap item), so the webview's native attack surface is limited to what the OS webview engine exposes.

> webview 始终从 `http://127.0.0.1:<ctx.webServer.port>` 加载实时界面——与任何浏览器标签页相同的回环载体。目前**不存在**网页内容与原生代码之间的 IPC 桥接（HTTP→IPC 是路线图项），因此 webview 的原生攻击面仅限于操作系统 webview 引擎暴露的部分。

### Out of scope / 不在范围内

Report to the respective upstream projects; this package only consumes them:
> 你需要报告给对应上游项目，本包只引用它们：

- deepseek-harness itself and the Web app (`@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`): [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
  > deepseek-harness 本体及其 Web app (`@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`)：  [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- Web server, auth, and transport (`dsh-host-webserver`).
  > Web 服务器，鉴权和传输 (`dsh-host-webserver`)
- WebviewJS: [webviewjs/webview](https://github.com/webviewjs/webview)
- `sharp`: [lovell/sharp](https://github.com/lovell/sharp)
- The OS webview engines themselves: WebView2 (Microsoft), WebKit (Apple), WebKitGTK (GNOME).
  > 操作系统 webview 引擎： WebView2（微软公司），WebKit（苹果公司），WebKitGTK（GNOME项目）。 

If a report turns out to belong upstream, we will point you there and close with a reference.

> 如果报告最终属于上游，我们会指引你到对应项目，并在附上引用后关闭。

## Reporting a Vulnerability / 报告漏洞

For anything exploitable — remote code execution, privilege issues, exposure of data through the wrapper — use GitHub's private vulnerability reporting: **Security → Report a vulnerability**. Reports stay private until a fix is ready.

> 对于任何可利用的问题——远程代码执行、权限问题、经由此外壳造成的数据泄露——请使用 GitHub 的私有漏洞报告入口：**Security → Report a vulnerability**。在修复就绪之前，报告保持私密。

For non-sensitive bugs and questions, a regular issue or discussion is fine.

> 对于非敏感的问题与疑问，使用普通 issue 或 discussion 即可。

Please include / 请提供:

- Affected version (from `package.json` or the installed tarball) / 影响版本（来自 `package.json` 或已安装的 tarball）
- How it was composed: profile, `dsh` version, platform (OS + webview engine) / 组合方式：profile、`dsh` 版本、平台（操作系统 + webview 引擎）
- Reproduction steps / 复现步骤
- Impact assessment: what an attacker gains, and under what preconditions / 影响评估：攻击者能获得什么，需要什么前提

Response expectations — best effort, solo maintainer / 响应预期——尽力而为，单人维护:

- Acknowledgment within **7 calendar days** / **7 个自然日**内确认收到
- Initial triage and severity assessment within **14 calendar days** / **14 个自然日**内完成初步分诊与严重性评估
- Coordinated disclosure: details are not published before a fix is available; we ask reporters for the same courtesy / 协同披露：修复可用之前不公开细节，也请报告者予以同样的配合

## Threat model notes / 威胁模型说明

- **Loopback HTTP, no TLS.** The surface is served over plain `http://127.0.0.1:<port>`, exactly like the browser flow, and the webserver binds to loopback. Any local process that can reach that port already has local access; do not add firewall rules or proxies that expose it.
  > **回环 HTTP，无 TLS。** 界面通过明文 `http://127.0.0.1:<port>` 提供，与浏览器流程完全一致，webserver 绑定回环地址。任何能访问该端口的本地进程本身就拥有本地访问权；不要添加暴露该端口的防火墙规则或代理。
- **No remote content.** The webview URL is constructed only from `ctx.webServer.port`; the wrapper never navigates to third-party URLs.
  > **无远程内容。** webview 的 URL 仅由 `ctx.webServer.port` 构造，外壳从不导航到第三方 URL。
- **Runs with user privileges.** The app runs with the invoking user's permissions. The wrapper adds no sandbox beyond the OS webview engine, and there is no native↔web IPC today that an attacker could leverage.
  > **以用户权限运行。** 应用以调用用户的权限运行。外壳不提供超出操作系统 webview 引擎之外的沙箱，且目前不存在可供攻击者利用的原生↔网页 IPC。
- **No credentials stored.** The wrapper stores no credentials; Harness/Web-app state lives in the profile and the webview engine's storage (cookies, localStorage), managed by the harness and the OS engine.
  > **不存储凭据。** 外壳不存储任何凭据；Harness/Web 应用状态位于 profile 与 webview 引擎的存储（cookies、localStorage）中，由 harness 与操作系统引擎管理。
- **Supply chain.** The wrapper's dependency chain (`@webviewjs/webview`, `sharp`) ships prebuilt platform binaries and declares no install scripts — installing it runs no native builds. Still, install only from trusted sources, keep the lockfile, and review manifests — including the `dsh.bundle.patch` declaration — before composing into a profile.
  > **供应链。** 本包的依赖链（`@webviewjs/webview`、`sharp`）以预编译平台二进制分发，且不声明任何 install 脚本——安装本包不会运行原生构建。但仍请只从可信来源安装、保留 lockfile，并在组合进 profile 前审查清单——包括 `dsh.bundle.patch` 声明。

## For contributors / 给贡献者的说明

- Pull requests that touch the native surface (`src/index.ts`), the composition layer (`cordis.patch.yml`), or dependency manifests should state their security impact in the description.
  > 触及原生面（`src/index.ts`）、组合层（`cordis.patch.yml`）或依赖清单的 PR，应在描述中说明其安全影响。
- Dependency discipline: harness packages are type-only and stay in `devDependencies`; never add a harness package to `dependencies` (a profile-local tree shadows the installation's junctions and breaks the composition).
  > 依赖纪律：harness 包均为仅类型引用，保持在 `devDependencies`；切勿将 harness 包加入 `dependencies`（profile 本地树会遮蔽安装 junction 并破坏组合）。
- `lib/` is build output — review `src/`, never `lib/`.
  > `lib/` 是构建产物——审查 `src/`，绝不审查 `lib/`。
