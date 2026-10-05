package com.nogoon.app

// ─── VpnController (STUB — Network Shield disabled, the default) ─────────────
//
// Same API as android-src/vpn/VpnController.kt but with NO reference to
// android.net.VpnService, NoGoonVpnService or BIND_VPN_SERVICE. Used for
// releases that must not declare a VPN service (Google Play "VPN service"
// declaration). To bring the feature back see docs/TODO.md ("Re-enable Network Shield").

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

@Suppress("UNUSED_PARAMETER")
class VpnController(ctx: ReactApplicationContext) {
    fun start(promise: Promise) = promise.reject("VPN_DISABLED", "Network Shield is not part of this build")
    fun stop(promise: Promise) = promise.resolve(true)
    fun isActive(promise: Promise) = promise.resolve(false)
    fun isPermissionGranted(promise: Promise) = promise.resolve(false)
}
