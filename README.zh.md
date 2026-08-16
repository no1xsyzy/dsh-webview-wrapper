# `dsh-webview-wrapper`

[English](README.md) | 中文

为 DeepSeek Harness 的 Web 界面提供一个朴素的（naive）原生桌面外壳。`dsh-webview-wrapper` 是 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的树外插件：它通过 [WebviewJS](https://webview.js.org) 把正在运行的 Web 应用装进一个操作系统原生窗口——使用平台自带的 webview 引擎（Windows 为 WebView2，macOS 为 WebKit，Linux 为 WebKitGTK），绝不打包浏览器内核。没有 Electron、没有 fork、不打 harness 的补丁。

贯彻「一切皆插件」的思路，本包只做纯组合：像普通树外插件一样装进某个 profile，bundle 的 patch 层插入一个插件行，插件在 Web 组合提供 `webServer` / `webRuntime` 服务后就位，并接管原生窗口的生命周期。harness 本体始终保持原装。

## 特性

- 为 `dsh web` 提供的界面套上原生窗口 + 系统托盘。
- 关闭即收进托盘：关窗只隐藏窗口，harness 继续运行（一个不可见的 1×1 keep-alive 窗口托住进程）。
- 托盘菜单（`Show` / `Quit`）与托盘双击。
- 干净退出：插件卸载（或 profile 关闭）时通过 effect 的 disposer 调用 `app.exit()`。
- 带 invariant 伴生插件（`dsh-webview-wrapper/invariant`），向 `InvariantRegistry` 注册。

## 安装

前置条件：

- 一份原装 deepseek-harness，其 profile 装配了 Web 组合包（`dsh web`）。本插件注入 `webServer` 与 `webRuntime`，目标 profile 必须是 Web 形态——随附的 `web` profile 就是天然目标。
- WebviewJS 的平台要求：Windows → WebView2（Windows 11 与新版 Edge 自带），macOS → 内置 WebKit（10.15+），Linux → WebKitGTK 4.1 与 `libxdo`。
- `pnpm`（插件管理器会把参数转发给 pnpm）。

### 快速开始

```sh
dsh plugin --profile web add dsh-webview-wrapper
dsh --profile web
```

### 自定义 profile

随附的 `web` profile 已经在 `dsh.profile.bundles` 里列好了 Web 层（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`）。想用自定义 profile，就从 `web` 复制一份，再只加 wrapper：

```sh
cp -r ~/.dsh/profiles/web ~/.dsh/profiles/ww
dsh plugin --profile ww add dsh-webview-wrapper
dsh --profile ww
```

### `add` 逐步做了什么

1. 首次使用时 `dsh plugin` 会先初始化 profile，然后在 profile 目录里执行 `pnpm add`。
2. 由于 `dsh-webview-wrapper` 的 manifest 声明了 `dsh.bundle.patch`，插件管理器会自动把它追加进 profile 的 `dsh.profile.bundles` 层栈。
3. 下次启动时，bundle 的 patch 层（[`cordis.patch.yml`](cordis.patch.yml)）向组合里插入 `webview` 插件行。
4. 插件等待 `webServer` / `webRuntime` 服务就绪后，接管原生窗口的生命周期。

### 一条规则：不要 `add` 内置 bundle

`dsh plugin add` 只用于**树外**插件。Web 组合包（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`）是**内置 bundle**：它们从 harness 安装目录加载、只应出现在 `dsh.profile.bundles` 里——绝不能进 profile 的 `dependencies`。把内置 bundle 加进依赖，pnpm 就会把整棵 harness 树装进 profile 的 `node_modules`：

- pnpm 以 `autoInstallPeers: false` 安装，这棵树缺 peer（如 `@deepseek-ai/cordis`）；在 profile 目录里跑 `pnpm peers check` 能看到。
- 启动时 loader 从 profile 目录解析插件，这些副本遮蔽了安装目录（`$DSH_HOME/profiles/node_modules` 的 junction），加载失败——工具调用就会报错。
- 中途还会先撞上一个症状：`@deepseek-ai/dsh-web-app` 会带入 harness 的本地目录选择器，其依赖 `koffi` 带构建脚本且未获批准；pnpm 11（默认 `strict-dep-builds: true`）于是非零退出（`ERR_PNPM_IGNORED_BUILDS`），`dsh plugin` 跳过 `dsh.profile.bundles` 回填，profile 启动时没有 Web 层。

要脱离这种状态：把内置 bundle 从 `dependencies` 里删掉（`dsh.profile.bundles` 里保留——它会从安装目录解析），然后在 profile 目录执行 `pnpm install` 清掉整棵 harness 树，再启动。

### 运行本地检出

先构建，再从目录安装：

```sh
pnpm run build
dsh plugin --profile web add file:/绝对/路径/dsh-webview-wrapper
```

## 使用

- **首次启动只进托盘**——在主动要求之前不会创建主窗口。双击托盘图标或选 `Show`，打开承载 `http://127.0.0.1:<port>`（即当前 Web 界面）的 1024×768 窗口。
- 关闭窗口＝收进托盘，harness 继续运行。
- 托盘菜单里的 `Quit` 退出应用。

## 工作原理

| 文件 | 职责 |
|---|---|
| `src/index.ts` | 插件本体：创建 WebviewJS `Application`、托盘与主窗口；路由 `custom-menu-click`、`window-close-requested`、`application-close-requested`；卸载时调用 `app.exit()`。 |
| `cordis.patch.yml` | bundle 的 patch 层：向组合插入 `{ id: webview, name: 'dsh-webview-wrapper' }`。 |
| `src/invariant.ts` | invariant 伴生插件，向 `InvariantRegistry` 注册本包。 |
| `assets/icon.svg` | 任务栏 / 托盘图标源文件，用 `sharp` 栅格化。 |

生命周期示意：

```
apply(ctx)
├─ readIcon(icon.svg, 16)          # 一次共享的异步栅格化
└─ ctx.effect(() =>                 # 插件生命周期 == 原生应用生命周期
   ├─ new Application()
   ├─ whenReady() → 1×1 keep-alive 窗口 + 托盘（Show/Quit）
   ├─ 托盘双击 / Show → createOrShowMainWindow()
   │    └─ BrowserWindow(1024×768) + webview → http://127.0.0.1:<ctx.webServer.port>
   ├─ window-close-requested → hide（关闭即收托盘）
   └─ disposer → app.exit()
```

## 已知短板与路线图

外壳刻意保持朴素，以下粗糙之处即路线图：

1. **没有原生通知**——harness 里发生的事不会变成系统通知。路线：接入 WebviewJS `Notification`。
2. **通用 HTTP 传输**——webview 通过 `http://127.0.0.1:<port>` 加载 Web 应用，和浏览器标签页走同一条 HTTP 通道。路线：改用 WebviewJS IPC（`webview.expose()` / `window.ipc.postMessage`）和自定义协议，去掉对 loopback HTTP 的依赖。
3. **没有菜单栏**——只有托盘菜单。路线：`app.setMenu()`，配上 File/Edit 角色与快捷键。
4. **黑窗 + 只能靠托盘退出**——经由 CLI 启动会带出一个控制台黑窗，退出路径只有托盘 `Quit` 与 profile 关闭。路线：打包成 GUI 子系统可执行文件（WebviewJS CLI / Node SEA）让黑窗消失，并在页面内提供退出入口。

其它现状：单窗口、启动时固定 1024×768、标题写死（暂无配置面）；启动时不打开主窗口（应用先驻留托盘）。

## 开发

```sh
git clone https://github.com/no1xsyzy/dsh-webview-wrapper.git
cd dsh-webview-wrapper
pnpm install
pnpm run build      # 每次修改后都需要运行这行
cp -r ~/.dsh/profiles/web ~/.dsh/profiles/ww-dev
dsh plugin --profile ww-dev add file:/绝对/路径/dsh-webview-wrapper
```

私人开发 profile 请按[自定义 profile](#自定义-profile)的方式复制 `web`——只 `add` 树外插件，绝不加内置的 `@deepseek-ai/dsh-web-app`。

注意事项：

- **本工作区从不直接运行应用。** wrapper 是插件：只能在 profile 组合内执行（它注入 `webServer` / `webRuntime`），因此本工作区没有开发服务器、也没有独立入口——其依赖链以预编译平台二进制分发，也不存在原生插件构建。测试请走 `dsh plugin ... add file:<路径>` 流程。
- `lib/` 与 `node_modules` 已在 .gitignore 中；`lib/` 是构建产物。
- **命名纪律（npm 发布）。** npm 包名必须与 `package.json` 的 `name`、`src/index.ts` 的插件名、`cordis.patch.yml` 的 bundle 行、`src/invariant.ts` 的注册名保持一致。插件管理器按包名解析 bundle，`InvariantRegistry` 按 npm 包名登记注册——改名需要四处同步。
- 保持 `README.md` 与 `README.zh.md` 同步。
