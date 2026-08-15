/**
 * Package-owned invariant companion for `dsh-webview-wrapper`.
 * @module dsh-webview-wrapper/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-webview-wrapper'

/** Cordis companion plugin name. */
export const name = 'dsh-webview-wrapper-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package is a composition-only desktop-surface
 * wrapper. It owns no observable event relationship or mutable-data
 * relationship of its own — the only data it consumes, the webview URL
 * derived from `ctx.webServer.port`, is a boot fact already owned by the
 * webserver lifecycle: a failed listen rejects that fiber before this
 * plugin's `webServer` injection ever resolves, so there is nothing left to
 * assert. Everything else this package does (window create/show/hide, tray
 * click routing, webview navigation) is GUI lifecycle of the external native
 * toolkit (@webviewjs/webview), which a runtime check could only tautologize
 * or flake on (windowing system, tray support, event timing); confirming the
 * plugin name, `inject` list, and effect wiring is a type/load concern.
 * Revisit when this package gains mutable state or an event protocol of its
 * own (native notifications, IPC message routing, menu commands), and add a
 * real check then.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
    Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
