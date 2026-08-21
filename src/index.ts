import type { Context } from '@deepseek-ai/cordis'
import {
    Application,
    type BrowserWindow,
    type JsTrayIcon,
    type JsWebview,
    type TrayIconImage
} from "@webviewjs/webview";
// noinspection ES6UnusedImports -- for injecting ctx.webServer
import type {} from "@deepseek-ai/dsh-host-webserver";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import sharp from 'sharp'

export const name = 'dsh-webview-wrapper'
export const inject = ['webRuntime', 'webServer']

const iconPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icon.svg');

async function readIcon(iconPath: string, size: number): Promise<TrayIconImage> {
    const { data, info: { width, height } } = await sharp(iconPath)
        .resize(size)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return { data, width, height }
}


export function apply(ctx: Context) {
    let iconReader = readIcon(iconPath, 16);
    ctx.effect(() => {
        const app = new Application();
        let mainWindow: BrowserWindow | null = null;
        let keepAliveWindow: BrowserWindow | null = null;

        let mainWebview: JsWebview | null = null;
        let tray: JsTrayIcon | null = null;

        app.whenReady().then(() => {
            keepAliveWindow = app.createBrowserWindow({ width: 1, height: 1, visible: false });
            iconReader.then((icon) => {
                tray = app.createTrayIcon({
                    icon,
                    tooltip: 'Deepseek Harness',
                    menu: {
                        items: [
                            {
                                id: 'show',
                                label: 'Show',
                            },
                            {
                                id: 'quit',
                                label: 'Quit',
                            }
                        ],
                    }
                })

                tray.on('double-click', createOrShowMainWindow)
            })
        });

        const createOrShowMainWindow = () => {
            if (mainWindow === null || mainWindow.isDisposed()) {
                iconReader.then((icon) => {
                    mainWindow = app.createBrowserWindow({
                        title: "Deepseek Harness",
                        width: 1024,
                        height: 768,
                        windowsTaskbarIcon: icon,
                    })

                    mainWebview = mainWindow.createWebview({
                        url: `http://127.0.0.1:${ctx.webServer.port}`,
                    })
                })
            } else {
                mainWindow.show()
                mainWindow.focus()
            }
        };

        app.on('custom-menu-click', ({ customMenuEvent }) => {
            switch (customMenuEvent?.id) {
                case 'show':
                    createOrShowMainWindow();
                    break;
                case 'quit':
                    app.exit()
                    break;
                default:
                    console.log('unknown customMenuEvent', customMenuEvent)
            }
        })

        app.on('window-close-requested', ({ event, customMenuEvent, ...ev }) => {
            mainWindow?.hide()
        });

        app.on('application-close-requested', (ev) => {
            app.exit()
        });

        return () => {
            app.exit()
        }
    })
}
